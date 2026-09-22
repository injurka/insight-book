import type { Book, PageDictEntry, PagePayload, TocItem } from '~/01.shared/types/models'
import { useQuery } from '@pinia/colada'

import { computed, onScopeDispose, ref, shallowRef, watch } from 'vue'
import { useRepos } from '~/00.plugins/di'
import { i18n } from '~/00.plugins/i18n'
import { useTracking } from '~/01.shared/composables/use-tracking'
import { queryKeys } from '~/01.shared/lib/query-keys'
import { useAnalysisStore } from '~/01.shared/store/analysis/analysis.store'
import { useGlobalSettingsStore } from '~/01.shared/store/settings.store'
import { useToastStore } from '~/01.shared/store/toast.store'
import { useLibraryStore } from '~/05.modules/library/store/library.store'
import { useHighlightsStore } from './highlights.store'

export const useReaderStore = defineStore('reader', () => {
  const repos = useRepos()
  const libraryStore = useLibraryStore()
  const { trackEvent } = useTracking()

  const currentBook = computed(() => libraryStore.currentBookInfo)
  const currentPage = shallowRef<PagePayload | null>(null)

  const currentPageDictionary = shallowRef<Record<string, PageDictEntry>>({})
  const currentToc = shallowRef<TocItem[]>([])

  const isPageLoading = ref(false)
  const isParallelView = computed(() => useGlobalSettingsStore().parallelViewMode === 'split')
  const tocOpen = ref(false)

  const targetPageNum = ref<number | null>(null)

  const displayPageNum = computed(() => {
    if (targetPageNum.value !== null)
      return targetPageNum.value

    return currentBook.value?.currentPage || 1
  })

  let lastTocBookId = 0
  let loadPageSeq = 0
  let autoAnalysisTimer: ReturnType<typeof setTimeout> | null = null
  let progressTimer: ReturnType<typeof setTimeout> | null = null
  let progressRequest: Promise<void> | null = null
  let pendingProgress: { bookId: number, pageNum: number } | null = null
  let pageDictionaryController: AbortController | null = null

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
      pageDictionaryController?.abort()
      pageDictionaryController = null
      currentPage.value = null
      currentPageDictionary.value = {}
      targetPageNum.value = null
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

  async function flushReadingProgress() {
    if (progressRequest || !pendingProgress)
      return

    const nextProgress = pendingProgress
    pendingProgress = null

    const request = libraryStore.updateBookInfo(nextProgress.bookId, { currentPage: nextProgress.pageNum })
    progressRequest = request

    try {
      await request
    }
    catch (error) {
      // Progress is best-effort: the page itself can still be read from the
      // repository cache, and the next navigation will enqueue the newest page.
      console.warn('[Reader] Failed to save reading progress:', error)
    }
    finally {
      progressRequest = null
      if (pendingProgress)
        void flushReadingProgress()
    }
  }

  function scheduleReadingProgress(bookId: number, pageNum: number) {
    pendingProgress = { bookId, pageNum }

    if (progressTimer)
      clearTimeout(progressTimer)

    progressTimer = setTimeout(() => {
      progressTimer = null
      void flushReadingProgress()
    }, 1500)
  }

  function updateReadingProgress(bookId: number, pageNum: number) {
    if (libraryStore.currentBookInfo && libraryStore.currentBookInfo.id === bookId)
      libraryStore.currentBookInfo.currentPage = pageNum

    scheduleReadingProgress(bookId, pageNum)
  }

  function triggerAutoAnalysis(settingsStore: ReturnType<typeof useGlobalSettingsStore>, analysisStore: ReturnType<typeof useAnalysisStore>) {
    if (autoAnalysisTimer) {
      clearTimeout(autoAnalysisTimer)
      autoAnalysisTimer = null
    }

    if (settingsStore.autoAnalyzePage && !analysisStore.isManualPageAnalysisActive) {
      const scheduledBookId = currentBook.value?.id
      const scheduledPageNum = currentPage.value?.pageNum

      autoAnalysisTimer = setTimeout(() => {
        autoAnalysisTimer = null
        if (
          !settingsStore.autoAnalyzePage
          || analysisStore.isManualPageAnalysisActive
          || currentBook.value?.id !== scheduledBookId
          || currentPage.value?.pageNum !== scheduledPageNum
        ) {
          return
        }

        analysisStore.analyzeWholePage({
          sentences: settingsStore.autoAnalyzeSentences,
          words: settingsStore.autoAnalyzeWords,
          ttsSentences: settingsStore.autoAnalyzeTtsSentences,
          ttsWords: settingsStore.autoAnalyzeTtsWords,
        }, true)
      }, 1000)
    }
  }

  let activeMangaBlobUrl: string | null = null

  function revokeActiveMangaBlobUrl() {
    if (activeMangaBlobUrl) {
      URL.revokeObjectURL(activeMangaBlobUrl)
      activeMangaBlobUrl = null
    }
  }

  async function resolveMangaImage(page: PagePayload) {
    if (page.type === 'manga' && page.imageUrl) {
      const cachedBlob = await repos.book.getLocalImage(Number(page.bookId), Number(page.pageNum))
      if (cachedBlob) {
        revokeActiveMangaBlobUrl()
        activeMangaBlobUrl = URL.createObjectURL(cachedBlob)
        page.localImageUrl = activeMangaBlobUrl
      }
    }
  }

  function resetAnalysisState(analysisStore: ReturnType<typeof useAnalysisStore>) {
    if (autoAnalysisTimer) {
      clearTimeout(autoAnalysisTimer)
      autoAnalysisTimer = null
    }

    analysisStore.cancelPageAnalysis()
    analysisStore.closePopover()
    analysisStore.closeSelectionTooltip()
    analysisStore.sidebarOpen = false
  }

  async function fetchPage(bookId: number, pageNum: number): Promise<PagePayload> {
    const analysisStore = useAnalysisStore()

    pageDictionaryController?.abort()
    const dictionaryController = new AbortController()
    pageDictionaryController = dictionaryController

    const dictionaryPromise = repos.book.getPageDict(bookId, pageNum, dictionaryController.signal)
      .then((newDict) => {
        if (!dictionaryController.signal.aborted)
          Object.assign(currentPageDictionary.value, newDict)
      })
      .catch(() => { })

    const newPage = await repos.book.getPage(bookId, pageNum)

    if (!newPage)
      throw new Error('Page not found')

    const page = { ...newPage }
    await resolveMangaImage(page)

    // A slow dictionary request must not keep the page spinner open. It is
    // cancelled when another page starts loading and may fill the dictionary
    // after the page content is already visible.
    void dictionaryPromise

    if (currentBook.value)
      void analysisStore.prewarmPageAnalysis(currentBook.value, page)

    return page
  }

  async function fetchAndApplyPageData(bookId: number, pageNum: number, seq: number) {
    const analysisStore = useAnalysisStore()
    const settingsStore = useGlobalSettingsStore()

    const page = await fetchPage(bookId, pageNum)

    if (seq !== loadPageSeq)
      return

    currentPage.value = page

    trackEvent('page_loaded', { bookId, pageNum, type: page?.type })
    triggerAutoAnalysis(settingsStore, analysisStore)
  }

  async function loadPage(bookId: number, pageNum: number) {
    const analysisStore = useAnalysisStore()
    const toastStore = useToastStore()

    const seq = ++loadPageSeq
    const prevPageNum = targetPageNum.value || currentBook.value?.currentPage || 1

    targetPageNum.value = pageNum
    currentPage.value = null

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
        pageDictionaryController?.abort()
        pageDictionaryController = null
        targetPageNum.value = prevPageNum
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

  onScopeDispose(() => {
    if (progressTimer)
      clearTimeout(progressTimer)
    pageDictionaryController?.abort()
  })

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
    targetPageNum.value = startPage

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
      revokeActiveMangaBlobUrl()
      currentPage.value = null
      currentPageDictionary.value = {}

      analysisStore.analysisHistory = []
      const pageToLoad = startPage || book.currentPage || 1
      targetPageNum.value = pageToLoad
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
    targetPageNum,
    displayPageNum,
    fetchToc,
    fetchPage,
    loadPage,
    updateReadingProgress,
    openBook,
    openBookById,
  }
})
