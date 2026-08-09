import type { Book, PageDictEntry, PagePayload, TocItem } from '~/01.shared/types/models'
import { useQuery } from '@pinia/colada'
import { useDebounceFn } from '@vueuse/core'

import { computed, ref, shallowRef, watch } from 'vue'
import { useRepos } from '~/00.plugins/di'
import { i18n } from '~/00.plugins/i18n'
import { useUmami } from '~/01.shared/composables/use-umami'
import { queryKeys } from '~/01.shared/lib/query-keys'
import { useAnalysisStore } from '~/01.shared/store/analysis/analysis.store'
import { useGlobalSettingsStore } from '~/01.shared/store/settings.store'
import { useToastStore } from '~/01.shared/store/toast.store'
import { useLibraryStore } from '~/05.modules/library/store/library.store'
import { useHighlightsStore } from './highlights.store'

export const useReaderStore = defineStore('reader', () => {
  const repos = useRepos()
  const libraryStore = useLibraryStore()
  const { trackEvent } = useUmami()

  const currentBook = computed(() => libraryStore.currentBookInfo)
  const currentPage = shallowRef<PagePayload | null>(null)

  const currentPageDictionary = shallowRef<Record<string, PageDictEntry>>({})
  const currentToc = shallowRef<TocItem[]>([])

  const isPageLoading = ref(false)
  const isParallelView = computed(() => useGlobalSettingsStore().parallelViewMode === 'split')
  const tocOpen = ref(false)

  let lastTocBookId = 0
  let loadPageSeq = 0

  // Query state refs
  const tocBookId = ref<number | null>(null)

  // 1. TOC Query
  const {
    data: tocQueryData,
    refetch: refetchTocQuery,
  } = useQuery<TocItem[]>({
    key: () => queryKeys.toc(tocBookId.value),
    query: async () => {
      const id = tocBookId.value
      if (!id)
        return []

      return repos.book.getToc(id)
    },
    enabled: () => tocBookId.value !== null,
  })

  // Watchers to map query results
  watch(tocQueryData, (newData) => {
    currentToc.value = newData || []
  }, { immediate: true })

  watch(() => libraryStore.currentBookInfo, (newBook) => {
    if (!newBook) {
      currentPage.value = null
      currentPageDictionary.value = {}
      const highlightsStore = useHighlightsStore()
      highlightsStore.clear()
      tocBookId.value = null
    }
  })

  watch(() => useGlobalSettingsStore().parallelViewMode, (mode) => {
    trackEvent('parallel_view_toggled', { mode })
  })

  watch(() => useGlobalSettingsStore().autoAnalyzePage, (isActive) => {
    const analysisStore = useAnalysisStore()
    if (isActive) {
      if (currentPage.value && !analysisStore.isManualPageAnalysisActive && !analysisStore.isAutoPageAnalysisActive) {
        const settingsStore = useGlobalSettingsStore()
        analysisStore.analyzeWholePage({
          sentences: settingsStore.autoAnalyzeSentences,
          words: settingsStore.autoAnalyzeWords,
          ttsSentences: settingsStore.autoAnalyzeTtsSentences,
          ttsWords: settingsStore.autoAnalyzeTtsWords,
        }, true)
      }
    }
    else if (analysisStore.isAutoPageAnalysisActive) {
      analysisStore.cancelPageAnalysis()
    }
  })

  watch(tocOpen, (isOpen) => {
    if (isOpen)
      trackEvent('toc_opened', { bookId: currentBook.value?.id })
  })

  async function fetchToc(bookId: number) {
    tocBookId.value = bookId
    try {
      await refetchTocQuery()
      lastTocBookId = bookId
    }
    catch {
      currentToc.value = []
    }
  }

  // Дебаунс для избежания перезатирания стейта при быстрых перелистываниях
  const debouncedUpdateProgress = useDebounceFn((bookId: number, pageNum: number) => {
    libraryStore.updateBookInfo(bookId, { currentPage: pageNum })
  }, 1500)

  function updateReadingProgress(bookId: number, pageNum: number) {
    if (libraryStore.currentBookInfo && libraryStore.currentBookInfo.id === bookId)
      libraryStore.currentBookInfo.currentPage = pageNum

    debouncedUpdateProgress(bookId, pageNum)
  }

  function triggerAutoAnalysis(settingsStore: ReturnType<typeof useGlobalSettingsStore>, analysisStore: ReturnType<typeof useAnalysisStore>) {
    if (settingsStore.autoAnalyzePage && !analysisStore.isManualPageAnalysisActive) {
      setTimeout(() => {
        analysisStore.analyzeWholePage({
          sentences: settingsStore.autoAnalyzeSentences,
          words: settingsStore.autoAnalyzeWords,
          ttsSentences: settingsStore.autoAnalyzeTtsSentences,
          ttsWords: settingsStore.autoAnalyzeTtsWords,
        }, true)
      }, 1000)
    }
  }

  async function resolveMangaImage(page: PagePayload) {
    if (page.type === 'manga' && page.imageUrl) {
      const cachedBlob = await repos.book.getLocalImage(Number(page.bookId), Number(page.pageNum))
      if (cachedBlob)
        page.localImageUrl = URL.createObjectURL(cachedBlob)
    }
  }

  function resetAnalysisState(analysisStore: ReturnType<typeof useAnalysisStore>) {
    analysisStore.cancelPageAnalysis()
    analysisStore.closePopover()
    analysisStore.closeSelectionTooltip()
    analysisStore.sidebarOpen = false
  }

  async function fetchAndApplyPageData(bookId: number, pageNum: number, seq: number) {
    const analysisStore = useAnalysisStore()
    const settingsStore = useGlobalSettingsStore()

    const [newPage, newDict] = await Promise.all([
      repos.book.getPage(bookId, pageNum),
      repos.book.getPageDict(bookId, pageNum).catch(() => ({})),
    ])

    if (!newPage)
      throw new Error('Page not found')

    const page = { ...newPage }
    await resolveMangaImage(page)

    if (seq !== loadPageSeq)
      return

    currentPage.value = page
    currentPageDictionary.value = newDict || {}

    trackEvent('page_loaded', { bookId, pageNum, type: page?.type })
    triggerAutoAnalysis(settingsStore, analysisStore)
  }

  async function loadPage(bookId: number, pageNum: number) {
    const analysisStore = useAnalysisStore()
    const toastStore = useToastStore()

    const seq = ++loadPageSeq
    const prevPageNum = currentBook.value?.currentPage || 1

    resetAnalysisState(analysisStore)

    if (currentToc.value.length === 0 || lastTocBookId !== bookId)
      fetchToc(bookId).catch(() => { })

    updateReadingProgress(bookId, pageNum)

    currentPageDictionary.value = {}
    isPageLoading.value = true

    try {
      await fetchAndApplyPageData(bookId, pageNum, seq)
    }
    catch (e) {
      if (seq === loadPageSeq) {
        updateReadingProgress(bookId, prevPageNum)
        toastStore.error(i18n.global.t('dictionary.pageOfflineError'))
      }

      throw e
    }
    finally {
      if (seq === loadPageSeq)
        isPageLoading.value = false
    }
  }

  async function openBook(book: Book) {
    trackEvent('book_opened', { bookId: book.id, type: book.type, language: book.language })

    const highlightsStore = useHighlightsStore()
    const analysisStore = useAnalysisStore()

    highlightsStore.clear()
    highlightsStore.fetchHighlights(book.id).catch(console.error)

    libraryStore.currentBookInfo = book
    currentPage.value = null
    currentPageDictionary.value = {}
    analysisStore.analysisHistory = []

    const startPage = book.currentPage || 1

    await loadPage(book.id, startPage)
  }

  async function openBookById(id: number, startPage?: number) {
    const analysisStore = useAnalysisStore()
    const highlightsStore = useHighlightsStore()

    isPageLoading.value = true

    try {
      if (libraryStore.books.length === 0)
        await libraryStore.fetchBooks()

      const book = libraryStore.books.find(b => b.id === id)
      if (!book)
        throw new Error(i18n.global.t('dictionary.bookNotFoundError'))

      trackEvent('book_opened', { bookId: book.id, type: book.type, language: book.language })

      highlightsStore.clear()
      highlightsStore.fetchHighlights(book.id).catch(console.error)

      libraryStore.currentBookInfo = book
      currentPage.value = null
      currentPageDictionary.value = {}

      analysisStore.analysisHistory = []
      const pageToLoad = startPage || book.currentPage || 1
      await loadPage(book.id, pageToLoad)
    }
    finally {
      isPageLoading.value = false
    }
  }

  return {
    currentBook,
    currentPage,
    currentPageDictionary,
    currentToc,
    isPageLoading,
    isParallelView,
    tocOpen,
    fetchToc,
    loadPage,
    openBook,
    openBookById,
  }
})
