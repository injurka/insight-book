import type { Book, BookStats } from '~/shared/types/models'
import { useReaderStore } from '~/components/05.modules/reader/store/reader.store'
import { api } from '~/shared/services/api.service'
import { useAnalysisStore } from '~/shared/store/analysis.store'

export const useLibraryStore = defineStore('library', () => {
  const books = ref<Book[]>([])
  const currentBookInfo = ref<Book | null>(null)

  const isLoading = ref(false)
  const isAnalyzingBook = ref(false)
  const isAnalyzingVocab = ref(false)
  const uploadProgress = ref(0)

  async function fetchBooks() {
    isLoading.value = true
    try {
      books.value = await api.books.list()
    }
    finally {
      isLoading.value = false
    }
  }

  async function fetchBookInfo(id: number) {
    if (currentBookInfo.value?.id !== id) {
      currentBookInfo.value = null
    }

    isLoading.value = true
    try {
      currentBookInfo.value = await api.books.getInfo(id)
    }
    finally {
      isLoading.value = false
    }
  }

  async function updateBookInfo(id: number, data: Partial<Book>) {
    await api.books.updateInfo(id, data)

    const listBook = books.value.find(b => b.id === id)
    if (listBook) {
      Object.assign(listBook, data)
    }

    if (currentBookInfo.value?.id === id) {
      Object.assign(currentBookInfo.value, data)
    }

    const readerStore = useReaderStore()
    if (readerStore.currentBook?.id === id) {
      Object.assign(readerStore.currentBook, data)
    }
  }

  async function analyzeFullBook(id: number) {
    isAnalyzingBook.value = true
    try {
      const res = await api.books.analyzeBook(id)
      if (currentBookInfo.value && currentBookInfo.value.id === id) {
        currentBookInfo.value.stats = res.stats
      }
    }
    finally {
      isAnalyzingBook.value = false
    }
  }

  async function analyzeVocabulary(id: number) {
    isAnalyzingVocab.value = true
    try {
      const res = await api.books.analyzeVocabulary(id)
      if (currentBookInfo.value?.id === id) {
        if (!currentBookInfo.value.stats) {
          currentBookInfo.value.stats = {} as BookStats
        }
        currentBookInfo.value.stats.posDistribution = res.lexicalStats.posDistribution
        currentBookInfo.value.stats.topWords = res.lexicalStats.topWords
        currentBookInfo.value.stats.lexicalDiversity = res.lexicalStats.lexicalDiversity
      }
    }
    finally {
      isAnalyzingVocab.value = false
    }
  }

  async function updateBookCover(id: number, file: File) {
    const res = await api.books.updateCover(id, file)
    if (currentBookInfo.value && currentBookInfo.value.id === id) {
      currentBookInfo.value.coverUrl = res.coverUrl
    }
    const listBook = books.value.find(b => b.id === id)
    if (listBook) {
      listBook.coverUrl = res.coverUrl
    }
  }

  async function updateBookStats(id: number, data: Partial<BookStats>) {
    const res = await api.books.updateStats(id, data)
    if (currentBookInfo.value && currentBookInfo.value.id === id) {
      currentBookInfo.value.stats = res.stats
    }
  }

  async function uploadBook(file: File) {
    isLoading.value = true
    try {
      const { book } = await api.books.upload(file)
      books.value.unshift(book)
      return book
    }
    finally {
      isLoading.value = false
    }
  }

  async function deleteBook(id: number) {
    await api.books.delete(id)
    books.value = books.value.filter(b => b.id !== id)

    const readerStore = useReaderStore()
    const analysisStore = useAnalysisStore()

    if (readerStore.currentBook?.id === id) {
      readerStore.currentBook = null
      readerStore.currentPage = null
      analysisStore.analysisHistory = []
    }
  }

  return {
    books,
    currentBookInfo,
    isLoading,
    isAnalyzingBook,
    isAnalyzingVocab,
    uploadProgress,

    fetchBooks,
    fetchBookInfo,
    updateBookInfo,
    analyzeFullBook,
    analyzeVocabulary,
    updateBookCover,
    updateBookStats,
    uploadBook,
    deleteBook,
  }
})
