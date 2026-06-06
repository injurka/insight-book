import type { Book, PageDictEntry, PagePayload, TocItem } from '~/shared/types/models'
import { useLibraryStore } from '~/components/05.modules/library/store/library.store'
import { i18n } from '~/shared/plugins/i18n'
import { api } from '~/shared/services/api.service'
import { offlineService } from '~/shared/services/offline.service'
import { useAnalysisStore } from '~/shared/store/analysis.store'
import { useToastStore } from '~/shared/store/toast.store'

export const useReaderStore = defineStore('reader', () => {
  const libraryStore = useLibraryStore()

  const currentBook = computed(() => libraryStore.currentBookInfo)
  const currentPage = ref<PagePayload | null>(null)

  // Словарь теперь независим от объекта страницы
  const currentPageDictionary = ref<Record<string, PageDictEntry>>({})
  const currentToc = ref<TocItem[]>([])

  const isPageLoading = ref(false)
  const isParallelView = ref(false)
  const tocOpen = ref(false)

  let lastTocBookId = 0

  watch(() => libraryStore.currentBookInfo, (newBook) => {
    if (!newBook) {
      currentPage.value = null
      currentPageDictionary.value = {}
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
      // 1. Ищем в кэше
      const cachedDict = await offlineService.getPageDictionary(bookId, pageNum)
      // Проверяем, что кэш не пустой, чтобы избежать бага вечно пустого словаря
      if (cachedDict && Object.keys(cachedDict).length > 0) {
        if (Number(currentPage.value?.bookId) === Number(bookId) && Number(currentPage.value?.pageNum) === Number(pageNum)) {
          currentPageDictionary.value = cachedDict
        }
        return
      }

      // 2. Если нет, грузим с сервера
      const res = await api.books.getPageDict(bookId, pageNum)
      if (Number(currentPage.value?.bookId) === Number(bookId) && Number(currentPage.value?.pageNum) === Number(pageNum)) {
        currentPageDictionary.value = res.pageDictionary || {}
        // Сохраняем в оффлайн-кэш
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

    // Сбрасываем словарь, чтобы не было фантомных кликов от старой страницы
    currentPageDictionary.value = {}
    isPageLoading.value = true

    try {
      const cachedPage = await offlineService.getPage(bookId, pageNum)
      if (cachedPage) {
        currentPage.value = cachedPage
        fetchPageDictionary(bookId, pageNum).catch(console.error)
        libraryStore.updateBookInfo(bookId, { currentPage: pageNum })
        return
      }

      const page = await api.books.getPage(bookId, pageNum)
      currentPage.value = page

      // Запрашиваем словарь асинхронно, не дожидаясь ответа
      fetchPageDictionary(bookId, pageNum).catch(console.error)

      await offlineService.savePage(bookId, pageNum, page)
      libraryStore.updateBookInfo(bookId, { currentPage: pageNum })
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
