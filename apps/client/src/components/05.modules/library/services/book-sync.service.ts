import type { LlmAnalysis } from '~/shared/types/models'
import { v4 as uuidv4 } from 'uuid'
import { ref } from 'vue'
import { useUmami } from '~/shared/composables/use-umami'
import { useRepos } from '~/shared/plugins/di'
import { useGlobalSettingsStore } from '~/shared/store/settings.store'

const repos = useRepos()

export const syncState = ref<'idle' | 'running' | 'finished' | 'error'>('idle')

export const syncProgress = ref({
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

export const syncOptions = ref({
  cachePages: true,
  analyzeSentences: false,
  analyzeWords: false,
  ttsSentences: false,
  ttsWords: false,
})

let syncAbortController: AbortController | null = null

export function cancelSync(): void {
  if (syncAbortController) {
    syncAbortController.abort()
    syncAbortController = null
  }
  syncState.value = 'idle'
}

export async function startWholeBookSync(
  bookId: number,
  options: {
    cachePages: boolean
    analyzeSentences: boolean
    analyzeWords?: boolean
    ttsSentences?: boolean
    ttsWords?: boolean
  },
): Promise<void> {
  // Lazy import to avoid circular dependencies
  const { useLibraryStore } = await import('../store/library.store')
  const libraryStore = useLibraryStore()
  const book = libraryStore.books.find(b => b.id === bookId) || libraryStore.currentBookInfo
  if (!book)
    return

  const { trackEvent } = useUmami()

  syncOptions.value = {
    cachePages: options.cachePages,
    analyzeSentences: options.analyzeSentences,
    analyzeWords: !!options.analyzeWords,
    ttsSentences: !!options.ttsSentences,
    ttsWords: !!options.ttsWords,
  }

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
      const toc = await repos.book.getToc(bookId)
      await repos.book.saveLocalToc(bookId, toc)
    }
    catch { }

    const needPageContent = options.cachePages || options.analyzeSentences || options.analyzeWords || options.ttsSentences || options.ttsWords

    if (options.cachePages && book.coverUrl && !book.localCoverUrl) {
      syncProgress.value.currentTask = 'Кэширование обложки...'
      const cachedCover = await repos.book.getLocalCover(book.id)
      if (!cachedCover) {
        try {
          const blob = await repos.book.fetchImageBlob(book.coverUrl)
          await repos.book.saveLocalCover(book.id, blob)
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

        const page = await repos.book.getPage(bookId, i, true)

        if (options.cachePages && page?.type === 'manga' && page.imageUrl) {
          const cachedImage = await repos.book.getLocalImage(bookId, i)
          if (!cachedImage) {
            try {
              const blob = await repos.book.fetchImageBlob(page.imageUrl)
              await repos.book.saveLocalImage(bookId, i, blob)
            }
            catch (e) {
              console.warn(`Failed to cache image for page ${i}`, e)
            }
          }
        }

        if (options.cachePages) {
          try {
            await repos.book.getPageDict(bookId, i)
          }
          catch (e) {
            console.warn(`Failed to fetch dictionary for page ${i}`, e)
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
            const cached = await repos.analysis.getLocalAnalysis(sentence)
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
              const checkItems = missingSentences.map(s => ({ text: s, type: 'sentence' as const }))
              const res = await repos.analysis.checkCache(bookId, checkItems, book.language, signal)
              const cacheMap = new Map(res.results.map((r: any) => [r.sentence, r.analysis]))

              for (let j = missingSentences.length - 1; j >= 0; j--) {
                const s = missingSentences[j]
                const serverCached = cacheMap.get(s) as unknown as LlmAnalysis
                if (serverCached) {
                  await repos.analysis.saveLocalAnalysis(s, serverCached)
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
              const itemsToAnalyze = batch.map(s => ({ id: uuidv4(), sentence: s, type: 'sentence' as const }))

              try {
                const res = await repos.analysis.analyzeBatch(bookId, itemsToAnalyze, book.language, signal)
                for (const result of res.results) {
                  const item = itemsToAnalyze.find(it => it.id === result.id)
                  if (item) {
                    await repos.analysis.saveLocalAnalysis(item.sentence, result.analysis)
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
            const cached = await repos.analysis.getLocalAnalysis(word)
            if (cached) {
              syncProgress.value.wordsDone++
            }
            else {
              missingWords.push(word)
            }
          }

          if (missingWords.length > 0) {
            try {
              const checkItems = missingWords.map(w => ({ text: w, type: 'word' as const }))
              const res = await repos.analysis.checkCache(bookId, checkItems, book.language, signal)
              const cacheMap = new Map(res.results.map((r: any) => [r.sentence, r.analysis]))

              for (let j = missingWords.length - 1; j >= 0; j--) {
                const w = missingWords[j]
                const serverCached = cacheMap.get(w) as unknown as LlmAnalysis
                if (serverCached) {
                  await repos.analysis.saveLocalAnalysis(w, serverCached)
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
              const itemsToAnalyze = batch.map(w => ({ id: uuidv4(), sentence: w, type: 'word' as const }))

              try {
                const res = await repos.analysis.analyzeBatch(bookId, itemsToAnalyze, book.language, signal)

                for (const result of res.results) {
                  const item = itemsToAnalyze.find(it => it.id === result.id)

                  if (item) {
                    await repos.analysis.saveLocalAnalysis(item.sentence, result.analysis)
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
          const voice = settingsStore.ttsVoice || 'Kore'

          for (let j = 0; j < ttsItems.length; j += ttsConcurrency) {
            if (signal.aborted)
              throw new Error('Aborted')
            const batch = ttsItems.slice(j, j + ttsConcurrency)

            await Promise.all(batch.map(async (text) => {
              if (signal.aborted)
                return
              const normalizedText = text.trim().toLowerCase()
              const cacheKey = `${bookId}_${voice}_${normalizedText}`

              try {
                const cached = await repos.analysis.getLocalTts(cacheKey)
                if (!cached) {
                  const res = await repos.analysis.generateTts(bookId, text, voice, signal)
                  await repos.analysis.saveLocalTts(cacheKey, res.audioBase64)
                }
              }
              catch (e: unknown) {
                if ((e as Error).name !== 'AbortError')
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
