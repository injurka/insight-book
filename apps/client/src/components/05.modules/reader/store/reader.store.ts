import type { Book, PagePayload, TocItem } from '~/shared/types/models'
import { useLibraryStore } from '~/components/05.modules/library/store/library.store'
import { api } from '~/shared/services/api.service'
import { offlineService } from '~/shared/services/offline.service'
import { useAnalysisStore } from '~/shared/store/analysis.store'
import { useToastStore } from '~/shared/store/toast.store'

export const useReaderStore = defineStore('reader', () => {
  const currentBook = ref<Book | null>(null)
  const currentPage = ref<PagePayload | null>(null)
  const currentToc = ref<TocItem[]>([])

  const isPageLoading = ref(false)
  const isParallelView = ref(false)
  const tocOpen = ref(false)

  let lastTocBookId = 0

  async function fetchToc(bookId: number) {
    try {
      currentToc.value = await api.books.getToc(bookId)
      await offlineService.saveToc(bookId, currentToc.value)
      lastTocBookId = bookId
    }
    catch (e) {
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

    const cached = await offlineService.getPage(bookId, pageNum)
    if (cached) {
      currentPage.value = cached
      if (currentBook.value)
        currentBook.value.currentPage = pageNum
      return
    }

    isPageLoading.value = true

    try {
      const page = await api.books.getPage(bookId, pageNum)
      currentPage.value = page

      await offlineService.savePage(bookId, pageNum, page)

      if (currentBook.value)
        currentBook.value.currentPage = pageNum
    }
    catch (e) {
      if (currentBook.value)
        currentBook.value.currentPage = prevPageNum

      toastStore.error('Эта страница недоступна в оффлайн-режиме')
      throw e
    }
    finally {
      isPageLoading.value = false
    }
  }

  async function openBook(book: Book) {
    currentBook.value = book
    currentPage.value = null
    const analysisStore = useAnalysisStore()
    analysisStore.analysisHistory = []
    const startPage = book.currentPage || 1
    await loadPage(book.id, startPage)
  }

  async function openBookById(id: number, startPage?: number) {
    const libraryStore = useLibraryStore()
    const analysisStore = useAnalysisStore()

    isPageLoading.value = true
    try {
      if (libraryStore.books.length === 0) {
        await libraryStore.fetchBooks()
      }
      const book = libraryStore.books.find(b => b.id === id)
      if (!book)
        throw new Error('Книга не найдена')

      currentBook.value = book
      currentPage.value = null

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
