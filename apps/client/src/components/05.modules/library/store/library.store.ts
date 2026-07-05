import type { Book, BookStats } from '~/shared/types/models'
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useUmami } from '~/shared/composables/use-umami'
import { api } from '~/shared/services/api.service'
import { offlineService } from '~/shared/services/offline.service'
import { useAuthStore } from '~/shared/store/auth.store'
import { attachCachedCovers } from '../services/book-cover.service'
import {
  cancelSync,
  startWholeBookSync,
  syncOptions,
  syncProgress,
  syncState,
} from '../services/book-sync.service'

export const useLibraryStore = defineStore('library', () => {
  const { trackEvent } = useUmami()

  const books = ref<Book[]>([])
  const publicBooks = ref<Book[]>([])
  const publicTotal = ref(0)
  const publicPage = ref(1)
  const publicLimit = ref(20)

  const currentBookInfo = ref<Book | null>(null)

  const isLoading = ref(false)
  const isInitialized = ref(false)
  const isAnalyzingBook = ref(false)
  const isAnalyzingVocab = ref(false)

  async function fetchBooks() {
    const authStore = useAuthStore()
    if (!authStore.user && !authStore.isSingleMode) {
      return
    }

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
      await attachCachedCovers(books.value)
      isLoading.value = false
      isInitialized.value = true
    }
  }

  async function fetchPublicBooks(page: number, tag?: string, search?: string, lang?: string) {
    isLoading.value = true
    try {
      const q = new URLSearchParams()

      q.set('tab', 'public')
      q.set('page', String(page))

      if (tag)
        q.set('tag', tag)

      if (search) {
        q.set('search', search)
        trackEvent('public_book_search', { query: search })
      }
      if (lang)
        q.set('lang', lang)

      const res = await api.books.getPublic(q.toString())
      publicBooks.value = res.data
      publicTotal.value = res.total
      publicPage.value = res.page
      publicLimit.value = res.limit
    }
    finally {
      await attachCachedCovers(publicBooks.value)
      isLoading.value = false
      isInitialized.value = true
    }
  }

  async function startReadingPublicBook(id: number) {
    await api.books.startReading(id)
    trackEvent('public_book_downloaded', { bookId: id })

    if (currentBookInfo.value?.id === id) {
      currentBookInfo.value.currentPage = 1
    }
    const authStore = useAuthStore()
    if (authStore.user || authStore.isSingleMode) {
      await fetchBooks()
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
      if (currentBookInfo.value) {
        await attachCachedCovers([currentBookInfo.value])
      }
      isLoading.value = false
    }
  }

  async function updateBookInfo(id: number, data: Partial<Book>) {
    const listBook = books.value.find(b => Number(b.id) === Number(id))
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
      console.warn('Failed to sync book info', e)
      throw e
    }
  }

  async function analyzeFullBook(id: number) {
    isAnalyzingBook.value = true
    trackEvent('book_full_analysis_started', { bookId: id })
    try {
      const res = await api.books.analyzeBook(id)
      if (currentBookInfo.value && currentBookInfo.value.id === id) {
        currentBookInfo.value.stats = res.stats
        await offlineService.saveBookInfo(id, currentBookInfo.value)
      }
    }
    finally { isAnalyzingBook.value = false }
  }

  async function analyzeVocabulary(id: number) {
    isAnalyzingVocab.value = true
    trackEvent('vocabulary_analysis_started', { bookId: id })
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
    finally { isAnalyzingVocab.value = false }
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
      const res = await api.books.upload(file)
      const book = 'book' in res ? res.book : (res as unknown as Book)
      const ext = file.name.split('.').pop()?.toLowerCase() || 'unknown'

      if (book)
        books.value.unshift(book)

      trackEvent('book_uploaded', { format: ext, size_mb: Math.round(file.size / 1048576) })

      return book
    }
    finally { isLoading.value = false }
  }

  async function createCustomManga(title: string, author: string, language: string) {
    isLoading.value = true
    try {
      const res = await api.books.createCustomBook({ title, author, language, type: 'manga' })
      books.value.unshift(res.book)

      trackEvent('custom_manga_created', { language })

      return res.book
    }
    finally { isLoading.value = false }
  }

  async function uploadMangaChapter(bookId: number, chapterTitle: string, files: File[]) {
    const fd = new FormData()
    fd.append('chapterTitle', chapterTitle)
    files.forEach(f => fd.append('files', f))
    const res = await api.books.appendMangaChapter(bookId, fd)

    const index = books.value.findIndex(b => b.id === bookId)
    if (index !== -1)
      Object.assign(books.value[index], res.book)

    if (currentBookInfo.value?.id === bookId) {
      Object.assign(currentBookInfo.value, res.book)
      if (typeof res.book.toc === 'string') {
        try {
          currentBookInfo.value.toc = JSON.parse(res.book.toc)
        }
        catch { }
      }
    }
    return res.book
  }

  async function deleteBook(id: number) {
    await api.books.delete(id)
    books.value = books.value.filter(b => b.id !== id)
    if (currentBookInfo.value?.id === id)
      currentBookInfo.value = null

    trackEvent('book_deleted')
  }

  return {
    books,
    publicBooks,
    publicTotal,
    publicPage,
    publicLimit,
    currentBookInfo,
    isLoading,
    isInitialized,
    isAnalyzingBook,
    isAnalyzingVocab,

    // Re-exported from book-sync.service for backward compatibility
    syncState,
    syncProgress,
    syncOptions,
    startWholeBookSync,
    cancelSync,

    fetchBooks,
    fetchPublicBooks,
    startReadingPublicBook,
    fetchBookInfo,
    updateBookInfo,
    analyzeFullBook,
    analyzeVocabulary,
    updateBookCover,
    updateBookStats,
    uploadBook,
    createCustomManga,
    uploadMangaChapter,
    deleteBook,
  }
})
