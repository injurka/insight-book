import type { Book, BookStats } from '~/shared/types/models'
import { defineStore } from 'pinia'
import { v4 as uuidv4 } from 'uuid'
import { ref } from 'vue'
import { useUmami } from '~/shared/composables/use-umami'
import { api } from '~/shared/services/api.service'
import { offlineService } from '~/shared/services/offline.service'
import { useAuthStore } from '~/shared/store/auth.store'
import { useGlobalSettingsStore } from '~/shared/store/settings.store'

export const useLibraryStore = defineStore('library', () => {
  const { trackEvent } = useUmami()

  const books = ref<Book[]>([])
  const publicBooks = ref<Book[]>([])
  const publicTotal = ref(0)
  const publicPage = ref(1)
  const publicLimit = ref(20)

  const currentBookInfo = ref<Book | null>(null)

  const isLoading = ref(false)
  const isAnalyzingBook = ref(false)
  const isAnalyzingVocab = ref(false)

  const syncState = ref<'idle' | 'running' | 'finished' | 'error'>('idle')
  const syncProgress = ref({
    pagesTotal: 0,
    pagesDone: 0,
    sentencesTotal: 0,
    sentencesDone: 0,
    wordsTotal: 0,
    wordsDone: 0,
    ttsTotal: 0,
    ttsDone: 0,
    currentTask: '',
  })

  let syncAbortController: AbortController | null = null

  async function attachCachedCovers(booksArr: Book[]) {
    for (const b of booksArr) {
      if (!b)
        continue
      if (b.coverUrl && !b.localCoverUrl) {
        try {
          const cached = await offlineService.getCover(b.id)
          if (cached)
            b.localCoverUrl = URL.createObjectURL(cached)
        }
        catch { }
      }
    }
  }

  function cancelSync() {
    if (syncAbortController) {
      syncAbortController.abort()
      syncAbortController = null
    }
    syncState.value = 'idle'
  }

  async function startWholeBookSync(bookId: number, options: { cachePages: boolean, analyzeSentences: boolean, analyzeWords?: boolean, ttsSentences?: boolean, ttsWords?: boolean }) {
    const book = books.value.find(b => b.id === bookId) || currentBookInfo.value
    if (!book)
      return

    trackEvent('book_sync_started', {
      cachePages: options.cachePages,
      analyzeSentences: options.analyzeSentences,
      analyzeWords: !!options.analyzeWords,
      ttsSentences: !!options.ttsSentences,
      ttsWords: !!options.ttsWords,
    })

    syncState.value = 'running'
    syncAbortController = new AbortController()
    const signal = syncAbortController.signal

    const settingsStore = useGlobalSettingsStore()
    const batchSize = settingsStore.useCustomLlm ? 1 : 5
    const concurrencyLimit = settingsStore.useCustomLlm ? 1 : 5

    syncProgress.value = {
      pagesTotal: book.totalPages,
      pagesDone: 0,
      sentencesTotal: 0,
      sentencesDone: 0,
      wordsTotal: 0,
      wordsDone: 0,
      ttsTotal: 0,
      ttsDone: 0,
      currentTask: 'Подготовка...',
    }

    try {
      try {
        const toc = await api.books.getToc(bookId)
        await offlineService.saveToc(bookId, toc)
      }
      catch { }

      const needPageContent = options.cachePages || options.analyzeSentences || options.analyzeWords || options.ttsSentences || options.ttsWords

      if (options.cachePages && book.coverUrl && !book.localCoverUrl) {
        syncProgress.value.currentTask = 'Кэширование обложки...'
        const cachedCover = await offlineService.getCover(book.id)
        if (!cachedCover) {
          try {
            const blob = await api.books.fetchImageBlob(book.coverUrl)
            await offlineService.saveCover(book.id, blob)
            book.localCoverUrl = URL.createObjectURL(blob)
          }
          catch (e) {
            console.warn('Failed to cache cover', e)
          }
        }
      }

      if (needPageContent) {
        for (let i = 1; i <= book.totalPages; i++) {
          if (signal.aborted)
            throw new Error('Aborted')
          syncProgress.value.currentTask = `Загрузка страницы ${i} из ${book.totalPages}`

          let page = await offlineService.getPage(bookId, i)
          if (!page) {
            page = await api.books.getPage(bookId, i, true)
            if (options.cachePages) {
              await offlineService.savePage(bookId, i, page)
            }
          }

          if (options.cachePages && page.type === 'manga' && page.imageUrl) {
            const cachedImage = await offlineService.getImage(bookId, i)
            if (!cachedImage) {
              try {
                const blob = await api.books.fetchImageBlob(page.imageUrl)
                await offlineService.saveImage(bookId, i, blob)
              }
              catch (e) {
                console.warn(`Failed to cache image for page ${i}`, e)
              }
            }
          }

          if (options.cachePages) {
            const dict = await offlineService.getPageDictionary(bookId, i)
            if (!dict) {
              try {
                const dictRes = await api.books.getPageDict(bookId, i)
                await offlineService.savePageDictionary(bookId, i, dictRes.pageDictionary)
              }
              catch (e) {
                console.warn(`Failed to fetch dictionary for page ${i}`, e)
              }
            }
          }

          syncProgress.value.pagesDone = i

          const pageSentences = new Set<string>()
          const pageWords = new Set<string>()

          if (page) {
            const extractData = (html: string) => {
              if (options.analyzeSentences || options.ttsSentences) {
                const sentRegex = /data-raw-sent="([^"]+)"/g
                let match
                // eslint-disable-next-line no-cond-assign
                while ((match = sentRegex.exec(html)) !== null) {
                  pageSentences.add(decodeURIComponent(match[1]))
                }
              }
              if (options.analyzeWords || options.ttsWords) {
                const wordRegex = /data-word="([^"]+)"[^>]*?data-pos="([^"]+)"/g
                let match
                // eslint-disable-next-line no-cond-assign
                while ((match = wordRegex.exec(html)) !== null) {
                  if (match[2] !== 'x') {
                    pageWords.add(decodeURIComponent(match[1]))
                  }
                }
              }
            }

            if (page.type === 'manga' && page.ocrBlocks) {
              page.ocrBlocks.forEach((b) => {
                if (b.html)
                  extractData(b.html)
              })
            }
            else if (page.content) {
              extractData(page.content)
            }
          }

          const sentences = Array.from(pageSentences).filter(s => /[\p{L}\p{N}]/u.test(s))
          const words = Array.from(pageWords).filter(w => /[\p{L}\p{N}]/u.test(w))

          if (options.analyzeSentences) {
            syncProgress.value.sentencesTotal += sentences.length
            const missingSentences: string[] = []

            for (const sentence of sentences) {
              const cached = await offlineService.getAnalysis(sentence)
              if (cached) {
                syncProgress.value.sentencesDone++
              }
              else {
                missingSentences.push(sentence)
              }
            }

            // Массовая проверка через бэкенд без LLM (только SQLite)
            if (missingSentences.length > 0) {
              try {
                const res = await api.books.checkCache(bookId, missingSentences, book.language, signal)
                const cacheMap = new Map(res.results.map((r: any) => [r.sentence, r.analysis]))

                for (let j = missingSentences.length - 1; j >= 0; j--) {
                  const s = missingSentences[j]
                  const serverCached = cacheMap.get(s)
                  if (serverCached) {
                    await offlineService.saveAnalysis(s, serverCached)
                    syncProgress.value.sentencesDone++
                    missingSentences.splice(j, 1)
                  }
                }
              }
              catch (e) {
                const err = e as Error
                if (err.name === 'AbortError')
                  throw err
              }
            }

            const batches: string[][] = []
            for (let j = 0; j < missingSentences.length; j += batchSize) {
              batches.push(missingSentences.slice(j, j + batchSize))
            }

            for (let j = 0; j < batches.length; j += concurrencyLimit) {
              if (signal.aborted)
                throw new Error('Aborted')
              const currentBatches = batches.slice(j, j + concurrencyLimit)

              await Promise.all(currentBatches.map(async (batch) => {
                const itemsToAnalyze = batch.map(s => ({ id: uuidv4(), sentence: s }))
                try {
                  const res = await api.books.analyzeBatch(bookId, itemsToAnalyze, book.language, signal)
                  for (const result of res.results) {
                    const item = itemsToAnalyze.find(it => it.id === result.id)
                    if (item) {
                      await offlineService.saveAnalysis(item.sentence, result.analysis)
                      syncProgress.value.sentencesDone++
                    }
                  }
                }
                catch (e) {
                  const err = e as Error
                  if (err.name !== 'AbortError')
                    console.error('Analyze sentence error:', err)
                }
              }))
              syncProgress.value.currentTask = `Анализ предложений: стр. ${i}, ${syncProgress.value.sentencesDone} / ${syncProgress.value.sentencesTotal}`
            }
          }

          if (options.analyzeWords) {
            syncProgress.value.wordsTotal += words.length
            const missingWords: string[] = []

            for (const word of words) {
              const cached = await offlineService.getAnalysis(word)
              if (cached) {
                syncProgress.value.wordsDone++
              }
              else {
                missingWords.push(word)
              }
            }

            if (missingWords.length > 0) {
              try {
                const res = await api.books.checkCache(bookId, missingWords, book.language, signal)
                const cacheMap = new Map(res.results.map((r: any) => [r.sentence, r.analysis]))

                for (let j = missingWords.length - 1; j >= 0; j--) {
                  const w = missingWords[j]
                  const serverCached = cacheMap.get(w)
                  if (serverCached) {
                    await offlineService.saveAnalysis(w, serverCached)
                    syncProgress.value.wordsDone++
                    missingWords.splice(j, 1)
                  }
                }
              }
              catch (e) {
                const err = e as Error
                if (err.name === 'AbortError')
                  throw err
              }
            }

            const batches: string[][] = []
            for (let j = 0; j < missingWords.length; j += batchSize) {
              batches.push(missingWords.slice(j, j + batchSize))
            }

            for (let j = 0; j < batches.length; j += concurrencyLimit) {
              if (signal.aborted)
                throw new Error('Aborted')
              const currentBatches = batches.slice(j, j + concurrencyLimit)

              await Promise.all(currentBatches.map(async (batch) => {
                const itemsToAnalyze = batch.map(w => ({ id: uuidv4(), sentence: w }))
                try {
                  const res = await api.books.analyzeBatch(bookId, itemsToAnalyze, book.language, signal)
                  for (const result of res.results) {
                    const item = itemsToAnalyze.find(it => it.id === result.id)
                    if (item) {
                      await offlineService.saveAnalysis(item.sentence, result.analysis)
                      syncProgress.value.wordsDone++
                    }
                  }
                }
                catch (e) {
                  const err = e as Error
                  if (err.name !== 'AbortError')
                    console.error('Analyze word error:', err)
                }
              }))
              syncProgress.value.currentTask = `Анализ слов: стр. ${i}, ${syncProgress.value.wordsDone} / ${syncProgress.value.wordsTotal}`
            }
          }

          if (options.ttsSentences || options.ttsWords) {
            const ttsItems: string[] = []
            if (options.ttsSentences)
              ttsItems.push(...sentences)
            if (options.ttsWords)
              ttsItems.push(...words)

            syncProgress.value.ttsTotal += ttsItems.length
            const ttsConcurrency = 3

            for (let j = 0; j < ttsItems.length; j += ttsConcurrency) {
              if (signal.aborted)
                throw new Error('Aborted')
              const batch = ttsItems.slice(j, j + ttsConcurrency)

              await Promise.all(batch.map(async (text) => {
                if (signal.aborted)
                  return
                const normalizedText = text.trim().toLowerCase()
                const cacheKey = `${bookId}_${normalizedText}`

                try {
                  const cached = await offlineService.getTts(cacheKey)
                  if (!cached) {
                    const res = await api.books.generateTts(bookId, text, signal)
                    await offlineService.saveTts(cacheKey, res.audioBase64)
                  }
                }
                catch (e: any) {
                  if (e.name !== 'AbortError')
                    console.error('TTS Sync error:', e)
                }
                syncProgress.value.ttsDone++
              }))
              syncProgress.value.currentTask = `Генерация аудио: стр. ${i}, ${syncProgress.value.ttsDone} / ${syncProgress.value.ttsTotal}`
            }
          }
        }
      }

      if (!signal.aborted) {
        syncState.value = 'finished'
        syncProgress.value.currentTask = 'Успешно завершено!'
      }
    }
    catch (e) {
      const err = e as Error
      if (err.message === 'Aborted' || err.name === 'AbortError') {
        syncState.value = 'idle'
      }
      else {
        syncState.value = 'error'
        syncProgress.value.currentTask = `Ошибка: ${err.message}`
      }
    }
    finally {
      syncAbortController = null
    }
  }

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
    isAnalyzingBook,
    isAnalyzingVocab,

    syncState,
    syncProgress,
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
