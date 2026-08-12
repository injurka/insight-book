import type { Book, BookStats } from '~/01.shared/types/models'
import { useMutation, useQuery, useQueryCache } from '@pinia/colada'
import { useRepos } from '~/00.plugins/di'
import { useTracking } from '~/01.shared/composables/use-tracking'
import { queryKeys } from '~/01.shared/lib/query-keys'
import { useAuthStore } from '~/01.shared/store/auth.store'
import { attachCachedCovers } from '../services/book-cover.service'
import {
  cancelSync,
  startWholeBookSync,
  syncOptions,
  syncProgress,
  syncState,
} from '../services/book-sync.service'

export const useLibraryStore = defineStore('library', () => {
  const { trackEvent } = useTracking()
  const queryCache = useQueryCache()
  const repos = useRepos()
  const authStore = useAuthStore()

  const books = shallowRef<Book[]>([])
  const publicBooks = shallowRef<Book[]>([])
  const publicTotal = ref(0)
  const publicPage = ref(1)
  const publicLimit = ref(20)
  const publicAppend = ref(false)

  const publicHasMore = computed(() => publicBooks.value.length < publicTotal.value)

  const currentBookInfo = ref<Book | null>(null)
  const currentBookId = ref<number | null>(null)

  /**
   * Настоящие данные книги (ответ `/api/books/:id/info`) для текущего id уже получены.
   * Отличие от `currentBookInfo`: последний может содержать оптимистичную копию
   * книги из списка библиотеки (префилл), пока API не ответил. По этому флагу
   * страница книги скрывает скелетон-оверлей.
   */
  const hasLoadedBookInfo = ref(false)

  const isInitialized = ref(false)
  const isAnalyzingBook = ref(false)
  const isAnalyzingVocab = ref(false)

  // --- QUERY: Books List ---
  const {
    data: booksData,
    error: booksError,
    isLoading: isBooksLoading,
    refetch: refetchBooks,
  } = useQuery<Book[]>({
    key: queryKeys.books.all,
    query: async () => repos.book.list(),
  })

  watch([booksData, isBooksLoading], ([newBooks, loading]) => {
    if (newBooks) {
      books.value = [...newBooks]
      void attachCachedCovers(books.value)
    }

    if (!loading) {
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
    key: () => queryKeys.books.public({
      page: publicQueryPage.value,
      tag: publicQueryTag.value,
      search: publicQuerySearch.value,
      lang: publicQueryLang.value,
    }),
    query: async () => {
      const q = new URLSearchParams()
      q.set('page', String(publicQueryPage.value))

      if (publicQueryTag.value)
        q.set('tag', publicQueryTag.value)

      if (publicQuerySearch.value) {
        q.set('search', publicQuerySearch.value)
        trackEvent('public_book_search', { query: publicQuerySearch.value })
      }

      if (publicQueryLang.value)
        q.set('lang', publicQueryLang.value)

      const res = await repos.book.getPublic(q.toString())

      return res
    },
    enabled: () => false,
  })

  watch(() => authStore.user, (newUser, oldUser) => {
    if (newUser && !oldUser) {
      fetchBooks()
    }
  })

  watch(publicBooksQueryData, async (res) => {
    if (res) {
      if (publicAppend.value && res.page > 1) {
        const existingIds = new Set(publicBooks.value.map(b => b.id))
        publicBooks.value = [...publicBooks.value, ...res.data.filter(b => !existingIds.has(b.id))]
      }
      else {
        publicBooks.value = res.data
      }

      publicAppend.value = false
      publicTotal.value = res.total
      publicPage.value = res.page
      publicLimit.value = res.limit
      await attachCachedCovers(publicBooks.value)
    }
  })

  async function fetchPublicBooks(
    page: number,
    tag?: string,
    search?: string,
    lang?: string,
    append = false,
  ) {
    publicAppend.value = append
    publicQueryPage.value = page
    publicQueryTag.value = tag
    publicQuerySearch.value = search
    publicQueryLang.value = lang
    await refetchPublicBooks()
  }

  // --- QUERY: Book Info ---
  const {
    data: bookInfoData,
    error: bookInfoError,
    isLoading: isBookInfoLoading,
    refetch: refetchBookInfo,
  } = useQuery<Book | null>({
    key: () => queryKeys.books(currentBookId.value),
    query: async () => {
      const id = currentBookId.value
      if (!id)
        return null

      return repos.book.getInfo(id)
    },
    enabled: () => currentBookId.value !== null,
  })

  watch(bookInfoData, async (newInfo) => {
    if (newInfo) {
      // Сначала прикрепляем локальную обложку, потом атомарно обновляем стейт —
      // чтобы src обложки не менялся после рендера (важно для View Transitions:
      // снапшот страницы должен содержать финальную картинку)
      await attachCachedCovers([newInfo])
      currentBookInfo.value = newInfo
      hasLoadedBookInfo.value = true
    }
  })

  // Ошибка API: снимаем скелетон-оверлей, чтобы страница не висела на шиммере
  // вечно — остаётся оптимистичная информация из префилла (или пустота, как раньше).
  watch(bookInfoError, (err) => {
    if (err)
      hasLoadedBookInfo.value = true
  })

  async function fetchBookInfo(id: number) {
    if (currentBookId.value !== id) {
      // Оптимистичный префилл: книга уже известна из списка библиотеки —
      // подставляем её сразу, чтобы страница рендерила реальную структуру
      // (обложка, название, автор, кнопки) с первого кадра. Ответ API затем
      // атомарно заменит currentBookInfo, а скелетон-оверлей скроет зоны,
      // данных по которым ещё нет.
      const known = books.value.find(b => b.id === id)
        ?? publicBooks.value.find(b => b.id === id)
      currentBookInfo.value = known ? { ...known } : null
      currentBookId.value = id
      hasLoadedBookInfo.value = false
    }
    else {
      await refetchBookInfo()
    }
  }

  // --- MUTATION: Start Reading Public Book ---
  const { mutateAsync: startReadingPublicBookMutation, isLoading: isStartingReading } = useMutation({
    mutation: async (id: number) => repos.book.startReading(id),
    async onSuccess(_, id) {
      trackEvent('public_book_downloaded', { bookId: id })
      if (currentBookInfo.value?.id === id)
        currentBookInfo.value.currentPage = 1

      const authStore = useAuthStore()
      if (authStore.user || authStore.isSingleMode)
        await refetchBooks()
    },
  })

  async function startReadingPublicBook(id: number) {
    await startReadingPublicBookMutation(id)
  }

  // --- MUTATION: Update Book Info ---
  const { mutateAsync: updateBookInfoMutation, isLoading: isUpdatingInfo } = useMutation({
    mutation: async ({ id, data }: { id: number, data: Partial<Book> }) => repos.book.updateInfo(id, data),
    onMutate({ id, data }) {
      const listBook = books.value.find(b => Number(b.id) === Number(id))
      if (listBook)
        Object.assign(listBook, data)

      if (currentBookInfo.value?.id === id)
        Object.assign(currentBookInfo.value, data)
    },
    async onSuccess(_, { id, data }) {
      queryCache.invalidateQueries({ key: queryKeys.books(id) })

      const keys = Object.keys(data)
      const isOnlyProgressUpdate = keys.length > 0 && keys.every(k => k === 'currentPage' || k === 'lastReadPosition' || k === 'updatedAt')
      if (!isOnlyProgressUpdate)
        queryCache.invalidateQueries({ key: queryKeys.books.all })

      if (currentBookInfo.value?.id === id)
        await repos.book.saveLocalBookInfo(id, currentBookInfo.value)
    },
  })

  async function updateBookInfo(id: number, data: Partial<Book>) {
    await updateBookInfoMutation({ id, data })
  }

  // --- MUTATION: Full Book Analysis ---
  const { mutateAsync: analyzeFullBookMutation } = useMutation({
    mutation: async (id: number) => repos.book.analyzeBook(id),
    async onSuccess(res, id) {
      if (currentBookInfo.value && currentBookInfo.value.id === id) {
        currentBookInfo.value.stats = res.stats
        await repos.book.saveLocalBookInfo(id, currentBookInfo.value)
      }

      queryCache.invalidateQueries({ key: queryKeys.books.all })
      queryCache.invalidateQueries({ key: queryKeys.books(id) })
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
    mutation: async (id: number) => repos.book.analyzeVocabulary(id),
    async onSuccess(res, id) {
      if (currentBookInfo.value?.id === id) {
        if (!currentBookInfo.value.stats)
          currentBookInfo.value.stats = {} as BookStats
        currentBookInfo.value.stats.posDistribution = res.lexicalStats.posDistribution
        currentBookInfo.value.stats.topWords = res.lexicalStats.topWords
        currentBookInfo.value.stats.lexicalDiversity = res.lexicalStats.lexicalDiversity
        await repos.book.saveLocalBookInfo(id, currentBookInfo.value)
      }

      queryCache.invalidateQueries({ key: queryKeys.books.all })
      queryCache.invalidateQueries({ key: queryKeys.books(id) })
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
    mutation: async ({ id, file }: { id: number, file: File }) => repos.book.updateCover(id, file),
    async onSuccess(res, { id }) {
      if (currentBookInfo.value && currentBookInfo.value.id === id) {
        currentBookInfo.value.coverUrl = res.coverUrl
        await repos.book.saveLocalBookInfo(id, currentBookInfo.value)
      }

      const listBook = books.value.find(b => b.id === id)
      if (listBook)
        listBook.coverUrl = res.coverUrl

      queryCache.invalidateQueries({ key: queryKeys.books.all })
      queryCache.invalidateQueries({ key: queryKeys.books(id) })
    },
  })

  async function updateBookCover(id: number, file: File) {
    await updateBookCoverMutation({ id, file })
  }

  // --- MUTATION: Update Stats ---
  const { mutateAsync: updateBookStatsMutation, isLoading: isUpdatingStats } = useMutation({
    mutation: async ({ id, data }: { id: number, data: Partial<BookStats> }) => repos.book.updateStats(id, data),
    async onSuccess(res, { id }) {
      if (currentBookInfo.value && currentBookInfo.value.id === id) {
        currentBookInfo.value.stats = res.stats
        await repos.book.saveLocalBookInfo(id, currentBookInfo.value)
      }

      queryCache.invalidateQueries({ key: queryKeys.books.all })
      queryCache.invalidateQueries({ key: queryKeys.books(id) })
    },
  })

  async function updateBookStats(id: number, data: Partial<BookStats>) {
    await updateBookStatsMutation({ id, data })
  }

  // --- MUTATION: Upload Book ---
  const { mutateAsync: uploadBookMutation, isLoading: isUploadingBook } = useMutation({
    mutation: async (file: File) => repos.book.upload(file),
    async onSuccess(res, file) {
      const book = 'book' in res ? res.book : (res as unknown as Book)
      const ext = file.name.split('.').pop()?.toLowerCase() || 'unknown'

      if (book) {
        books.value = [book, ...books.value]
        await refetchBooks()
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
    mutation: async (params: { title: string, author: string, language: string }) =>
      repos.book.createCustomManga({ ...params, type: 'manga' }),
    async onSuccess(res, params) {
      books.value = [res.book, ...books.value]
      await refetchBooks()
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
    mutation: async ({ bookId, fd }: { bookId: number, fd: FormData }) => repos.book.appendMangaChapter(bookId, fd),
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

      queryCache.invalidateQueries({ key: queryKeys.books.all })
      queryCache.invalidateQueries({ key: queryKeys.books(bookId) })

      return res.book
    },
  })

  async function uploadMangaChapter(bookId: number, chapterTitle: string, files: File[]) {
    const fd = new FormData()
    fd.append('chapterTitle', chapterTitle)
    files.forEach(f => fd.append('files', f))

    return uploadMangaChapterMutation({ bookId, fd })
  }

  // --- MUTATION: Delete Book ---
  const { mutateAsync: deleteBookMutation, isLoading: isDeletingBook } = useMutation({
    mutation: async (id: number) => repos.book.delete(id),
    onSuccess(_, id) {
      books.value = books.value.filter(b => b.id !== id)
      if (currentBookInfo.value?.id === id) {
        currentBookInfo.value = null
        currentBookId.value = null
      }

      queryCache.invalidateQueries({ key: queryKeys.books.all })
      trackEvent('book_deleted')
    },
  })

  async function deleteBook(id: number) {
    await deleteBookMutation(id)
  }

  // --- Global Loading State ---
  const isLoading = computed(() => {
    const loadingStates = [
      isBooksLoading,
      isPublicBooksLoading,
      isBookInfoLoading,
      isStartingReading,
      isUpdatingInfo,
      isUpdatingCover,
      isUpdatingStats,
      isUploadingBook,
      isCreatingManga,
      isUploadingChapter,
      isDeletingBook,
    ]

    return loadingStates.some(state => state.value)
  })

  return {
    books,
    booksError,
    publicBooks,
    publicTotal,
    publicPage,
    publicLimit,
    publicHasMore,
    isPublicLoading: isPublicBooksLoading,
    currentBookInfo,
    hasLoadedBookInfo,
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
