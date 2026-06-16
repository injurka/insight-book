import type { Book, PageDictEntry, PagePayload, TocItem } from '~/shared/types/models'
import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { useLibraryStore } from '~/components/05.modules/library/store/library.store'
import { useUmami } from '~/shared/composables/use-umami'
import { i18n } from '~/shared/plugins/i18n'
import { api } from '~/shared/services/api.service'
import { offlineService } from '~/shared/services/offline.service'
import { useAnalysisStore } from '~/shared/store/analysis.store'
import { useGlobalSettingsStore } from '~/shared/store/settings.store'
import { useToastStore } from '~/shared/store/toast.store'

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

  watch(() => libraryStore.currentBookInfo, (newBook) => {
    if (!newBook) {
      currentPage.value = null
      currentPageDictionary.value = {}
    }
  })

  watch(() => useGlobalSettingsStore().parallelViewMode, (mode) => {
    trackEvent('parallel_view_toggled', { mode })
  })

  watch(() => useGlobalSettingsStore().autoAnalyzePage, (isActive) => {
    const analysisStore = useAnalysisStore()
    if (isActive) {
      if (currentPage.value && !analysisStore.isManualPageAnalysisActive && !analysisStore.isAutoPageAnalysisActive) {
        analysisStore.analyzeWholePage({ sentences: true, words: true, ttsSentences: false, ttsWords: false }, true)
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
    try {
      currentToc.value = await api.books.getToc(bookId)
      await offlineService.saveToc(bookId, currentToc.value)
      lastTocBookId = bookId
    }
    catch {
      const cached = await offlineService.getToc(bookId)
      if (cached) {
        currentToc.value = cached
        lastTocBookId = bookId
      }
      else {
        currentToc.value = []
      }
    }
  }

  async function fetchPageDictionary(bookId: number, pageNum: number) {
    try {
      const cachedDict = await offlineService.getPageDictionary(bookId, pageNum)
      if (cachedDict && Object.keys(cachedDict).length > 0) {
        if (Number(currentPage.value?.bookId) === Number(bookId) && Number(currentPage.value?.pageNum) === Number(pageNum)) {
          currentPageDictionary.value = cachedDict
        }
        return
      }

      const res = await api.books.getPageDict(bookId, pageNum)
      if (Number(currentPage.value?.bookId) === Number(bookId) && Number(currentPage.value?.pageNum) === Number(pageNum)) {
        currentPageDictionary.value = res.pageDictionary || {}
        await offlineService.savePageDictionary(bookId, pageNum, currentPageDictionary.value)
      }
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
      let page: PagePayload | null = await offlineService.getPage(bookId, pageNum)

      if (!page) {
        page = await api.books.getPage(bookId, pageNum)
        await offlineService.savePage(bookId, pageNum, page)
      }

      if (page && page.type === 'manga' && page.imageUrl) {
        const cachedBlob = await offlineService.getImage(bookId, pageNum)
        if (cachedBlob) {
          page.localImageUrl = URL.createObjectURL(cachedBlob)
        }
      }

      currentPage.value = page
      fetchPageDictionary(bookId, pageNum).catch(console.error)
      libraryStore.updateBookInfo(bookId, { currentPage: pageNum })

      trackEvent('page_loaded', { bookId, pageNum, type: page?.type })

      const settingsStore = useGlobalSettingsStore()
      if (settingsStore.autoAnalyzePage && !analysisStore.isManualPageAnalysisActive) {
        setTimeout(() => {
          analysisStore.analyzeWholePage({ sentences: true, words: true, ttsSentences: false, ttsWords: false }, true)
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
