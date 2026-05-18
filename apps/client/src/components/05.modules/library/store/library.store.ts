import type { Book, BookStats } from '~/shared/types/models'
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { api } from '~/shared/services/api.service'
import { offlineService } from '~/shared/services/offline.service'

export const useLibraryStore = defineStore('library', () => {
  const books = ref<Book[]>([])
  const currentBookInfo = ref<Book | null>(null)

  const isLoading = ref(false)
  const isAnalyzingBook = ref(false)
  const isAnalyzingVocab = ref(false)

  async function fetchBooks() {
    isLoading.value = true
    try {
      books.value = await api.books.list()
      await offlineService.saveBooksList(books.value)
    }
    catch {
      const cached = await offlineService.getBooksList()
      if (cached)
        books.value = cached
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
      const info = await api.books.getInfo(id)
      currentBookInfo.value = info
      await offlineService.saveBookInfo(id, info)
    }
    catch (e) {
      const cached = await offlineService.getBookInfo(id)
      if (cached)
        currentBookInfo.value = cached
      else throw e
    }
    finally {
      isLoading.value = false
    }
  }

  async function updateBookInfo(id: number, data: Partial<Book>) {
    const listBook = books.value.find(b => b.id === id)
    if (listBook)
      Object.assign(listBook, data)

    if (currentBookInfo.value?.id === id) {
      Object.assign(currentBookInfo.value, data)
      await offlineService.saveBookInfo(id, currentBookInfo.value)
    }

    try {
      await api.books.updateInfo(id, data)
    }
    catch (e) {
      console.warn('Failed to sync book info to server', e)
    }
  }

  async function analyzeFullBook(id: number) {
    isAnalyzingBook.value = true
    try {
      const res = await api.books.analyzeBook(id)
      if (currentBookInfo.value && currentBookInfo.value.id === id) {
        currentBookInfo.value.stats = res.stats
        await offlineService.saveBookInfo(id, currentBookInfo.value)
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
        if (!currentBookInfo.value.stats)
          currentBookInfo.value.stats = {} as BookStats
        currentBookInfo.value.stats.posDistribution = res.lexicalStats.posDistribution
        currentBookInfo.value.stats.topWords = res.lexicalStats.topWords
        currentBookInfo.value.stats.lexicalDiversity = res.lexicalStats.lexicalDiversity
        await offlineService.saveBookInfo(id, currentBookInfo.value)
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
      await offlineService.saveBookInfo(id, currentBookInfo.value)
    }
    const listBook = books.value.find(b => b.id === id)
    if (listBook)
      listBook.coverUrl = res.coverUrl
  }

  async function updateBookStats(id: number, data: Partial<BookStats>) {
    const res = await api.books.updateStats(id, data)
    if (currentBookInfo.value && currentBookInfo.value.id === id) {
      currentBookInfo.value.stats = res.stats
      await offlineService.saveBookInfo(id, currentBookInfo.value)
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
    if (currentBookInfo.value?.id === id) {
      currentBookInfo.value = null
    }
  }

  return {
    books,
    currentBookInfo,
    isLoading,
    isAnalyzingBook,
    isAnalyzingVocab,
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
