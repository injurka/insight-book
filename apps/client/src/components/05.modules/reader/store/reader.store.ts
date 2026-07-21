import type { Book, PageDictEntry, PagePayload, TocItem } from '~/shared/types/models'
import { useQuery } from '@pinia/colada'
import { useDebounceFn } from '@vueuse/core'
import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { useLibraryStore } from '~/components/05.modules/library/store/library.store'
import { useUmami } from '~/shared/composables/use-umami'
import { useRepos } from '~/shared/plugins/di'
import { i18n } from '~/shared/plugins/i18n'
import { useAnalysisStore } from '~/shared/store/analysis.store'
import { useGlobalSettingsStore } from '~/shared/store/settings.store'
import { useToastStore } from '~/shared/store/toast.store'
import { useHighlightsStore } from './highlights.store'

export const useReaderStore = defineStore('reader', () => {
  const repos = useRepos()
  const libraryStore = useLibraryStore()
  const { trackEvent } = useUmami()

  const currentBook = computed(() => libraryStore.currentBookInfo)
  const currentPage = ref<PagePayload | null>(null)

  const currentPageDictionary = ref<Record<string, PageDictEntry>>({})
  const currentToc = ref<TocItem[]>([])

  const isPageLoading = ref(false)
  const isParallelView = computed(() => useGlobalSettingsStore().parallelViewMode === 'split')
  const tocOpen = ref(false)

  let lastTocBookId = 0

  // Query state refs
  const tocBookId = ref<number | null>(null)

  // 1. TOC Query
  const {
    data: tocQueryData,
    refetch: refetchTocQuery,
  } = useQuery<TocItem[]>({
    key: () => ['books', tocBookId.value, 'toc'],
    query: async () => {
      const id = tocBookId.value
      if (!id)
        return []
      return await repos.book.getToc(id)
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
    else {
      if (analysisStore.isAutoPageAnalysisActive) {
        analysisStore.cancelPageAnalysis()
      }
    }
  })

  watch(tocOpen, (isOpen) => {
    if (isOpen) {
      trackEvent('toc_opened', { bookId: currentBook.value?.id })
    }
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
    if (libraryStore.currentBookInfo && libraryStore.currentBookInfo.id === bookId) {
      libraryStore.currentBookInfo.currentPage = pageNum
    }
    debouncedUpdateProgress(bookId, pageNum)
  }

  async function loadPage(bookId: number, pageNum: number) {
    const analysisStore = useAnalysisStore()
    const toastStore = useToastStore()

    const prevPageNum = currentBook.value?.currentPage || 1

    analysisStore.cancelPageAnalysis()
    analysisStore.closePopover()
    analysisStore.closeSelectionTooltip()
    analysisStore.sidebarOpen = false

    if (currentToc.value.length === 0 || lastTocBookId !== bookId) {
      fetchToc(bookId).catch(() => { })
    }

    currentPageDictionary.value = {}
    isPageLoading.value = true

    try {
      // Исполняем прямые запросы для избежания дубликатов из useQuery()
      const [newPage, newDict] = await Promise.all([
        repos.book.getPage(bookId, pageNum),
        repos.book.getPageDict(bookId, pageNum).catch(() => ({} as Record<string, PageDictEntry>)),
      ])

      if (!newPage)
        throw new Error('Page not found')

      const page = { ...newPage }
      if (page.type === 'manga' && page.imageUrl) {
        const cachedBlob = await repos.book.getLocalImage(Number(page.bookId), Number(page.pageNum))
        if (cachedBlob) {
          page.localImageUrl = URL.createObjectURL(cachedBlob)
        }
      }

      currentPage.value = page
      currentPageDictionary.value = newDict || {}

      updateReadingProgress(bookId, pageNum)

      trackEvent('page_loaded', { bookId, pageNum, type: page?.type })

      const settingsStore = useGlobalSettingsStore()
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
    catch (e) {
      updateReadingProgress(bookId, prevPageNum)
      toastStore.error(i18n.global.t('dictionary.pageOfflineError'))
      throw e
    }
    finally {
      isPageLoading.value = false
    }
  }

  async function openBook(book: Book) {
    trackEvent('book_opened', { bookId: book.id, type: book.type, language: book.language })

    const highlightsStore = useHighlightsStore()
    highlightsStore.clear()
    highlightsStore.fetchHighlights(book.id).catch(console.error)

    libraryStore.currentBookInfo = book
    currentPage.value = null
    currentPageDictionary.value = {}
    const analysisStore = useAnalysisStore()
    analysisStore.analysisHistory = []
    const startPage = book.currentPage || 1
    await loadPage(book.id, startPage)
  }

  async function openBookById(id: number, startPage?: number) {
    const analysisStore = useAnalysisStore()

    isPageLoading.value = true
    try {
      if (libraryStore.books.length === 0) {
        await libraryStore.fetchBooks()
      }
      const book = libraryStore.books.find(b => b.id === id)
      if (!book)
        throw new Error(i18n.global.t('dictionary.bookNotFoundError'))

      trackEvent('book_opened', { bookId: book.id, type: book.type, language: book.language })

      const highlightsStore = useHighlightsStore()
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
