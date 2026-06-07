import type { Book, BookStats, PageDictEntry, PagePayload, TocItem } from '~/shared/types/models'
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

    syncState.value = 'running'
    syncAbortController = new AbortController()
    const signal = syncAbortController.signal

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
      // 1. Оглавление
      try {
        const toc = await api.books.getToc(bookId)
        await offlineService.saveToc(bookId, toc)
      }
      catch { }

      // 2. Постраничная загрузка и анализ
      if (options.cachePages || options.analyzeSentences || options.analyzeWords || options.ttsSentences || options.ttsWords) {
        for (let i = 1; i <= book.totalPages; i++) {
          if (signal.aborted)
            throw new Error('Aborted')
          syncProgress.value.currentTask = `Загрузка страницы ${i} из ${book.totalPages}`

          // 2.1 Кэширование самой страницы
          let page = await offlineService.getPage(bookId, i)
          if (!page && options.cachePages) {
            page = await api.books.getPage(bookId, i, true)
            await offlineService.savePage(bookId, i, page)
          }

          // 2.2 Словарь страницы
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

          // Извлекаем элементы для анализа из загруженной страницы
          const pageSentences = new Set<string>()
          const pageWords = new Set<string>()

          if ((options.analyzeSentences || options.analyzeWords || options.ttsSentences || options.ttsWords) && page) {
            const extractData = (html: string) => {
              if (options.analyzeSentences || options.ttsSentences) {
                const sentRegex = /data-raw-sent="([^"]+)"/g
                let match
                while ((match = sentRegex.exec(html)) !== null) {
                  pageSentences.add(decodeURIComponent(match[1]))
                }
              }
              if (options.analyzeWords || options.ttsWords) {
                const wordRegex = /data-word="([^"]+)"[^>]*?data-pos="([^"]+)"/g
                let match
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

          // 2.3 Анализ предложений страницы
          if (options.analyzeSentences) {
            syncProgress.value.sentencesTotal += sentences.length

            const concurrency = 2
            for (let j = 0; j < sentences.length; j += concurrency) {
              if (signal.aborted)
                throw new Error('Aborted')
              const batch = sentences.slice(j, j + concurrency)

              await Promise.all(batch.map(async (sentence) => {
                if (signal.aborted)
                  return
                const cached = await offlineService.getAnalysis(bookId, sentence)
                if (!cached) {
                  try {
                    const res = await api.books.analyze(bookId, sentence, book.language, signal)
                    await offlineService.saveAnalysis(bookId, sentence, res)
                  }
                  catch (e) {
                    const err = e as Error
                    if (err.name !== 'AbortError')
                      console.error('Analyze error:', err)
                  }
                }
                syncProgress.value.sentencesDone++
              }))
              syncProgress.value.currentTask = `Анализ предложений: стр. ${i}, ${syncProgress.value.sentencesDone} / ${syncProgress.value.sentencesTotal}`
            }
          }

          // 2.4 Анализ слов страницы
          if (options.analyzeWords) {
            syncProgress.value.wordsTotal += words.length

            const concurrency = 2
            for (let j = 0; j < words.length; j += concurrency) {
              if (signal.aborted)
                throw new Error('Aborted')
              const batch = words.slice(j, j + concurrency)

              await Promise.all(batch.map(async (word) => {
                if (signal.aborted)
                  return
                const cached = await offlineService.getAnalysis(bookId, word)
                if (!cached) {
                  try {
                    const res = await api.books.analyze(bookId, word, book.language, signal)
                    await offlineService.saveAnalysis(bookId, word, res)
                  }
                  catch (e) {
                    const err = e as Error
                    if (err.name !== 'AbortError')
                      console.error('Analyze word error:', err)
                  }
                }
                syncProgress.value.wordsDone++
              }))
              syncProgress.value.currentTask = `Анализ слов: стр. ${i}, ${syncProgress.value.wordsDone} / ${syncProgress.value.wordsTotal}`
            }
          }

          // 2.5 TTS (Озвучка)
          if (options.ttsSentences || options.ttsWords) {
            const ttsItems: string[] = []
            if (options.ttsSentences)
              ttsItems.push(...sentences)
            if (options.ttsWords)
              ttsItems.push(...words)

            syncProgress.value.ttsTotal += ttsItems.length

            const concurrency = 2
            for (let j = 0; j < ttsItems.length; j += concurrency) {
              if (signal.aborted)
                throw new Error('Aborted')
              const batch = ttsItems.slice(j, j + concurrency)

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

  // ... (Остальной код library.store.ts без изменений)
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
      console.warn('Failed to sync book info to server', e)
      throw e
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
      const res = await api.books.upload(file)
      const book = 'book' in res ? res.book : (res as unknown as Book)
      if (book) {
        books.value.unshift(book)
      }
      return book
    }
    finally {
      isLoading.value = false
    }
  }

  async function createCustomManga(title: string, author: string, language: string) {
    isLoading.value = true
    try {
      const res = await api.books.createCustomBook({ title, author, language, type: 'manga' })
      books.value.unshift(res.book)
      return res.book
    }
    finally {
      isLoading.value = false
    }
  }

  async function uploadMangaChapter(bookId: number, chapterTitle: string, files: File[]) {
    const fd = new FormData()
    fd.append('chapterTitle', chapterTitle)
    files.forEach(f => fd.append('files', f))

    const res = await api.books.appendMangaChapter(bookId, fd)

    const index = books.value.findIndex(b => b.id === bookId)
    if (index !== -1) {
      Object.assign(books.value[index], res.book)
    }
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

    syncState,
    syncProgress,
    startWholeBookSync,
    cancelSync,

    fetchBooks,
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
