import type { Book, PageDictEntry, PagePayload, TocItem } from '~/shared/types/models'
import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { useLibraryStore } from '~/components/05.modules/library/store/library.store'
import { useUmami } from '~/shared/composables/use-umami'
import { createOfflineQuery } from '~/shared/lib/query'
import { i18n } from '~/shared/plugins/i18n'
import { api } from '~/shared/services/api.service'
import { offlineService } from '~/shared/services/offline.service'
import { useAnalysisStore } from '~/shared/store/analysis.store'
import { useGlobalSettingsStore } from '~/shared/store/settings.store'
import { useToastStore } from '~/shared/store/toast.store'
import { useHighlightsStore } from './highlights.store'

export const useReaderStore = defineStore('reader', () => {
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
  const pageBookId = ref<number | null>(null)
  const pagePageNum = ref<number | null>(null)
  const dictBookId = ref<number | null>(null)
  const dictPageNum = ref<number | null>(null)

  // 1. TOC Query
  const {
    data: tocQueryData,
    refetch: refetchTocQuery,
  } = createOfflineQuery<TocItem[]>({
    key: () => ['books', tocBookId.value, 'toc'],
    networkQuery: async () => {
      const id = tocBookId.value
      if (!id)
        return []
      return await api.books.getToc(id)
    },
    saveOfflineData: async (data) => {
      const id = tocBookId.value
      if (id) {
        await offlineService.saveToc(id, data)
      }
    },
    getOfflineData: async () => {
      const id = tocBookId.value
      if (!id)
        return null
      return await offlineService.getToc(id)
    },
    enabled: () => tocBookId.value !== null,
  })

  // 2. Page Query
  const {
    data: pageQueryData,
    refetch: refetchPageQuery,
  } = createOfflineQuery<PagePayload | null>({
    key: () => ['books', pageBookId.value, 'pages', pagePageNum.value],
    strategy: 'offline-first',
    networkQuery: async () => {
      const id = pageBookId.value
      const num = pagePageNum.value
      if (id === null || num === null)
        return null
      return await api.books.getPage(id, num)
    },
    saveOfflineData: async (data) => {
      const id = pageBookId.value
      const num = pagePageNum.value
      if (id !== null && num !== null && data) {
        await offlineService.savePage(id, num, data)
      }
    },
    getOfflineData: async () => {
      const id = pageBookId.value
      const num = pagePageNum.value
      if (id === null || num === null)
        return null
      return await offlineService.getPage(id, num)
    },
    enabled: () => pageBookId.value !== null && pagePageNum.value !== null,
  })

  // 3. Page Dictionary Query
  const {
    data: dictQueryData,
    refetch: refetchDictQuery,
  } = createOfflineQuery<Record<string, PageDictEntry>>({
    key: () => ['books', dictBookId.value, 'pages', dictPageNum.value, 'dict'],
    strategy: 'offline-first',
    networkQuery: async () => {
      const id = dictBookId.value
      const num = dictPageNum.value
      if (id === null || num === null)
        return {}
      const res = await api.books.getPageDict(id, num)
      return res.pageDictionary || {}
    },
    saveOfflineData: async (data) => {
      const id = dictBookId.value
      const num = dictPageNum.value
      if (id !== null && num !== null) {
        await offlineService.savePageDictionary(id, num, data)
      }
    },
    getOfflineData: async () => {
      const id = dictBookId.value
      const num = dictPageNum.value
      if (id === null || num === null)
        return null
      return await offlineService.getPageDictionary(id, num)
    },
    enabled: () => dictBookId.value !== null && dictPageNum.value !== null,
  })

  // Watchers to map query results
  watch(tocQueryData, (newData) => {
    currentToc.value = newData || []
  }, { immediate: true })

  watch(pageQueryData, async (newPage) => {
    if (newPage) {
      const pageBookIdVal = pageBookId.value
      const pagePageNumVal = pagePageNum.value
      const page = { ...newPage }
      if (page.type === 'manga' && page.imageUrl) {
        const cachedBlob = await offlineService.getImage(Number(page.bookId), Number(page.pageNum))
        if (pageBookId.value === pageBookIdVal && pagePageNum.value === pagePageNumVal) {
          if (cachedBlob) {
            page.localImageUrl = URL.createObjectURL(cachedBlob)
          }
          currentPage.value = page
        }
      }
      else {
        if (pageBookId.value === pageBookIdVal && pagePageNum.value === pagePageNumVal) {
          currentPage.value = page
        }
      }
    }
    else {
      currentPage.value = null
    }
  }, { immediate: true })

  watch(dictQueryData, (newData) => {
    currentPageDictionary.value = newData || {}
  }, { immediate: true })

  watch(() => libraryStore.currentBookInfo, (newBook) => {
    if (!newBook) {
      currentPage.value = null
      currentPageDictionary.value = {}
      const highlightsStore = useHighlightsStore()
      highlightsStore.clear()
      tocBookId.value = null
      pageBookId.value = null
      pagePageNum.value = null
      dictBookId.value = null
      dictPageNum.value = null
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

  async function fetchPageDictionary(bookId: number, pageNum: number) {
    dictBookId.value = bookId
    dictPageNum.value = pageNum
    try {
      await refetchDictQuery()
    }
    catch (e) {
      console.warn('Failed to load page dictionary', e)
    }
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
      await fetchToc(bookId).catch(() => { })
    }

    currentPageDictionary.value = {}
    isPageLoading.value = true

    try {
      pageBookId.value = bookId
      pagePageNum.value = pageNum

      await refetchPageQuery()

      const page = pageQueryData.value

      fetchPageDictionary(bookId, pageNum).catch(console.error)
      libraryStore.updateBookInfo(bookId, { currentPage: pageNum })

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
      libraryStore.updateBookInfo(bookId, { currentPage: prevPageNum })
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
