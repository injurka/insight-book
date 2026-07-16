import type { Book, BookStats } from '~/shared/types/models'
import { useMutation, useQuery, useQueryCache } from '@pinia/colada'
import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { useUmami } from '~/shared/composables/use-umami'
import { createOfflineQuery } from '~/shared/lib/query'
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
  const queryCache = useQueryCache()

  const books = ref<Book[]>([])
  const publicBooks = ref<Book[]>([])
  const publicTotal = ref(0)
  const publicPage = ref(1)
  const publicLimit = ref(20)

  const currentBookInfo = ref<Book | null>(null)
  const currentBookId = ref<number | null>(null)

  const isInitialized = ref(false)
  const isAnalyzingBook = ref(false)
  const isAnalyzingVocab = ref(false)

  // --- QUERY: Books List ---
  const {
    data: booksData,
    isLoading: isBooksLoading,
    refetch: refetchBooks,
  } = createOfflineQuery<Book[]>({
    key: ['books'],
    networkQuery: async () => {
      const authStore = useAuthStore()
      if (!authStore.user && !authStore.isSingleMode) {
        return []
      }
      return await api.books.list()
    },
    saveOfflineData: async (list) => {
      await offlineService.saveBooksList(list)
    },
    getOfflineData: async () => {
      return await offlineService.getBooksList()
    },
  })

  watch(booksData, async (newBooks) => {
    if (newBooks) {
      books.value = [...newBooks]
      await attachCachedCovers(books.value)
      isInitialized.value = true
    }
  }, { immediate: true })

  async function fetchBooks() {
    await refetchBooks()
  }

  // --- QUERY: Public Books ---
  const publicQueryPage = ref(1)
  const publicQueryTag = ref<string | undefined>()
  const publicQuerySearch = ref<string | undefined>()
  const publicQueryLang = ref<string | undefined>()

  const {
    data: publicBooksQueryData,
    isLoading: isPublicBooksLoading,
    refetch: refetchPublicBooks,
  } = useQuery({
    key: () => ['books', 'public', {
      page: publicQueryPage.value,
      tag: publicQueryTag.value,
      search: publicQuerySearch.value,
      lang: publicQueryLang.value,
    }],
    query: async () => {
      const q = new URLSearchParams()
      q.set('tab', 'public')
      q.set('page', String(publicQueryPage.value))

      if (publicQueryTag.value)
        q.set('tag', publicQueryTag.value)

      if (publicQuerySearch.value) {
        q.set('search', publicQuerySearch.value)
        trackEvent('public_book_search', { query: publicQuerySearch.value })
      }
      if (publicQueryLang.value)
        q.set('lang', publicQueryLang.value)

      const res = await api.books.getPublic(q.toString())
      return res
    },
    enabled: () => isInitialized.value,
  })

  watch(publicBooksQueryData, async (res) => {
    if (res) {
      publicBooks.value = res.data
      publicTotal.value = res.total
      publicPage.value = res.page
      publicLimit.value = res.limit
      await attachCachedCovers(publicBooks.value)
    }
  })

  async function fetchPublicBooks(page: number, tag?: string, search?: string, lang?: string) {
    publicQueryPage.value = page
    publicQueryTag.value = tag
    publicQuerySearch.value = search
    publicQueryLang.value = lang
    await refetchPublicBooks()
  }

  // --- QUERY: Book Info ---
  const {
    data: bookInfoData,
    isLoading: isBookInfoLoading,
    refetch: refetchBookInfo,
  } = createOfflineQuery<Book | null>({
    key: () => ['books', currentBookId.value],
    networkQuery: async () => {
      const id = currentBookId.value
      if (!id)
        return null
      return await api.books.getInfo(id)
    },
    saveOfflineData: async (info) => {
      const id = currentBookId.value
      if (id && info) {
        await offlineService.saveBookInfo(id, info)
      }
    },
    getOfflineData: async () => {
      const id = currentBookId.value
      if (!id)
        return null
      return await offlineService.getBookInfo(id)
    },
    enabled: () => currentBookId.value !== null,
  })

  watch(bookInfoData, async (newInfo) => {
    if (newInfo) {
      currentBookInfo.value = newInfo
      await attachCachedCovers([currentBookInfo.value])
    }
  })

  async function fetchBookInfo(id: number) {
    if (currentBookId.value !== id) {
      currentBookInfo.value = null
      currentBookId.value = id
    }
    else {
      await refetchBookInfo()
    }
  }

  // --- MUTATION: Start Reading Public Book ---
  const { mutateAsync: startReadingPublicBookMutation, isLoading: isStartingReading } = useMutation({
    mutation: (id: number) => api.books.startReading(id),
    async onSuccess(_, id) {
      trackEvent('public_book_downloaded', { bookId: id })
      if (currentBookInfo.value?.id === id) {
        currentBookInfo.value.currentPage = 1
      }
      const authStore = useAuthStore()
      if (authStore.user || authStore.isSingleMode) {
        await refetchBooks()
      }
    },
  })

  async function startReadingPublicBook(id: number) {
    await startReadingPublicBookMutation(id)
  }

  // --- MUTATION: Update Book Info ---
  const { mutateAsync: updateBookInfoMutation, isLoading: isUpdatingInfo } = useMutation({
    mutation: ({ id, data }: { id: number, data: Partial<Book> }) => api.books.updateInfo(id, data),
    onMutate({ id, data }) {
      const listBook = books.value.find(b => Number(b.id) === Number(id))
      if (listBook)
        Object.assign(listBook, data)

      if (currentBookInfo.value?.id === id) {
        Object.assign(currentBookInfo.value, data)
      }
    },
    async onSuccess(_, { id }) {
      queryCache.invalidateQueries({ key: ['books'] })
      queryCache.invalidateQueries({ key: ['books', id] })

      if (currentBookInfo.value?.id === id) {
        await offlineService.saveBookInfo(id, currentBookInfo.value)
      }
    },
  })

  async function updateBookInfo(id: number, data: Partial<Book>) {
    await updateBookInfoMutation({ id, data })
  }

  // --- MUTATION: Full Book Analysis ---
  const { mutateAsync: analyzeFullBookMutation } = useMutation({
    mutation: (id: number) => api.books.analyzeBook(id),
    async onSuccess(res, id) {
      if (currentBookInfo.value && currentBookInfo.value.id === id) {
        currentBookInfo.value.stats = res.stats
        await offlineService.saveBookInfo(id, currentBookInfo.value)
      }
      queryCache.invalidateQueries({ key: ['books'] })
      queryCache.invalidateQueries({ key: ['books', id] })
    },
  })

  async function analyzeFullBook(id: number) {
    isAnalyzingBook.value = true
    trackEvent('book_full_analysis_started', { bookId: id })
    try {
      await analyzeFullBookMutation(id)
    }
    finally {
      isAnalyzingBook.value = false
    }
  }

  // --- MUTATION: Vocabulary Analysis ---
  const { mutateAsync: analyzeVocabularyMutation } = useMutation({
    mutation: (id: number) => api.books.analyzeVocabulary(id),
    async onSuccess(res, id) {
      if (currentBookInfo.value?.id === id) {
        if (!currentBookInfo.value.stats)
          currentBookInfo.value.stats = {} as BookStats
        currentBookInfo.value.stats.posDistribution = res.lexicalStats.posDistribution
        currentBookInfo.value.stats.topWords = res.lexicalStats.topWords
        currentBookInfo.value.stats.lexicalDiversity = res.lexicalStats.lexicalDiversity
        await offlineService.saveBookInfo(id, currentBookInfo.value)
      }
      queryCache.invalidateQueries({ key: ['books'] })
      queryCache.invalidateQueries({ key: ['books', id] })
    },
  })

  async function analyzeVocabulary(id: number) {
    isAnalyzingVocab.value = true
    trackEvent('vocabulary_analysis_started', { bookId: id })
    try {
      await analyzeVocabularyMutation(id)
    }
    finally {
      isAnalyzingVocab.value = false
    }
  }

  // --- MUTATION: Update Cover ---
  const { mutateAsync: updateBookCoverMutation, isLoading: isUpdatingCover } = useMutation({
    mutation: ({ id, file }: { id: number, file: File }) => api.books.updateCover(id, file),
    async onSuccess(res, { id }) {
      if (currentBookInfo.value && currentBookInfo.value.id === id) {
        currentBookInfo.value.coverUrl = res.coverUrl
        await offlineService.saveBookInfo(id, currentBookInfo.value)
      }
      const listBook = books.value.find(b => b.id === id)
      if (listBook)
        listBook.coverUrl = res.coverUrl

      queryCache.invalidateQueries({ key: ['books'] })
      queryCache.invalidateQueries({ key: ['books', id] })
    },
  })

  async function updateBookCover(id: number, file: File) {
    await updateBookCoverMutation({ id, file })
  }

  // --- MUTATION: Update Stats ---
  const { mutateAsync: updateBookStatsMutation, isLoading: isUpdatingStats } = useMutation({
    mutation: ({ id, data }: { id: number, data: Partial<BookStats> }) => api.books.updateStats(id, data),
    async onSuccess(res, { id }) {
      if (currentBookInfo.value && currentBookInfo.value.id === id) {
        currentBookInfo.value.stats = res.stats
        await offlineService.saveBookInfo(id, currentBookInfo.value)
      }
      queryCache.invalidateQueries({ key: ['books'] })
      queryCache.invalidateQueries({ key: ['books', id] })
    },
  })

  async function updateBookStats(id: number, data: Partial<BookStats>) {
    await updateBookStatsMutation({ id, data })
  }

  // --- MUTATION: Upload Book ---
  const { mutateAsync: uploadBookMutation, isLoading: isUploadingBook } = useMutation({
    mutation: (file: File) => api.books.upload(file),
    onSuccess(res, file) {
      const book = 'book' in res ? res.book : (res as unknown as Book)
      const ext = file.name.split('.').pop()?.toLowerCase() || 'unknown'

      if (book) {
        books.value.unshift(book)
        queryCache.invalidateQueries({ key: ['books'] })
      }

      trackEvent('book_uploaded', { format: ext, size_mb: Math.round(file.size / 1048576) })
      return book
    },
  })

  async function uploadBook(file: File) {
    const res = await uploadBookMutation(file)
    return 'book' in res ? res.book : (res as unknown as Book)
  }

  // --- MUTATION: Create Custom Manga ---
  const { mutateAsync: createCustomMangaMutation, isLoading: isCreatingManga } = useMutation({
    mutation: (params: { title: string, author: string, language: string }) =>
      api.books.createCustomBook({ ...params, type: 'manga' }),
    onSuccess(res, params) {
      books.value.unshift(res.book)
      queryCache.invalidateQueries({ key: ['books'] })
      trackEvent('custom_manga_created', { language: params.language })
      return res.book
    },
  })

  async function createCustomManga(title: string, author: string, language: string) {
    const res = await createCustomMangaMutation({ title, author, language })
    return res.book
  }

  // --- MUTATION: Upload Manga Chapter ---
  const { mutateAsync: uploadMangaChapterMutation, isLoading: isUploadingChapter } = useMutation({
    mutation: ({ bookId, fd }: { bookId: number, fd: FormData }) => api.books.appendMangaChapter(bookId, fd),
    onSuccess(res, { bookId }) {
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
      queryCache.invalidateQueries({ key: ['books'] })
      queryCache.invalidateQueries({ key: ['books', bookId] })
      return res.book
    },
  })

  async function uploadMangaChapter(bookId: number, chapterTitle: string, files: File[]) {
    const fd = new FormData()
    fd.append('chapterTitle', chapterTitle)
    files.forEach(f => fd.append('files', f))
    return await uploadMangaChapterMutation({ bookId, fd })
  }

  // --- MUTATION: Delete Book ---
  const { mutateAsync: deleteBookMutation, isLoading: isDeletingBook } = useMutation({
    mutation: (id: number) => api.books.delete(id),
    onSuccess(_, id) {
      books.value = books.value.filter(b => b.id !== id)
      if (currentBookInfo.value?.id === id) {
        currentBookInfo.value = null
        currentBookId.value = null
      }
      queryCache.invalidateQueries({ key: ['books'] })
      trackEvent('book_deleted')
    },
  })

  async function deleteBook(id: number) {
    await deleteBookMutation(id)
  }

  // --- Global Loading State ---
  const isLoading = computed(() => {
    return isBooksLoading.value
      || isPublicBooksLoading.value
      || isBookInfoLoading.value
      || isStartingReading.value
      || isUpdatingInfo.value
      || isUpdatingCover.value
      || isUpdatingStats.value
      || isUploadingBook.value
      || isCreatingManga.value
      || isUploadingChapter.value
      || isDeletingBook.value
  })

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
