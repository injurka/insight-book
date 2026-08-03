import type { LlmAnalysis, PagePayload } from '~/01.shared/types/models'
import { v4 as uuidv4 } from 'uuid'
import { ref } from 'vue'
import { useRepos } from '~/00.plugins/di'
import { useUmami } from '~/01.shared/composables/use-umami'
import { useGlobalSettingsStore } from '~/01.shared/store/settings.store'
import { extractPageData } from './book-sync-parser'

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

interface SyncBook {
  id: number
  language: string
  totalPages: number
  coverUrl: string | null
  localCoverUrl?: string | null
}

interface AnalysisContext {
  bookId: number
  language: string
  signal: AbortSignal
  batchSize: number
  concurrencyLimit: number
}

let syncAbortController: AbortController | null = null

export function cancelSync(): void {
  if (syncAbortController) {
    syncAbortController.abort()
    syncAbortController = null
  }

  syncState.value = 'idle'
}

/** Синхронизирует оглавление книги (ошибки не прерывают синк). */
async function syncBookToc(bookId: number): Promise<void> {
  try {
    const toc = await repos.book.getToc(bookId)
    await repos.book.saveLocalToc(bookId, toc)
  }
  catch { }
}

/** Кэширует обложку книги локально, если её ещё нет. */
async function cacheBookCover(book: SyncBook, cachePages: boolean): Promise<void> {
  if (!cachePages || !book.coverUrl || book.localCoverUrl)
    return

  syncProgress.value.currentTask = 'Кэширование обложки...'
  const cachedCover = await repos.book.getLocalCover(book.id)
  if (cachedCover)
    return

  try {
    const blob = await repos.book.fetchImageBlob(book.coverUrl)
    await repos.book.saveLocalCover(book.id, blob)
    book.localCoverUrl = URL.createObjectURL(blob)
  }
  catch (e) {
    console.warn('Failed to cache cover', e)
  }
}

/** Кэширует изображение manga-страницы и словарь страницы. */
async function cachePageAssets(
  bookId: number,
  page: PagePayload | undefined,
  pageNum: number,
  cachePages: boolean,
): Promise<void> {
  if (!cachePages)
    return

  if (page?.type === 'manga' && page.imageUrl) {
    const cachedImage = await repos.book.getLocalImage(bookId, pageNum)
    if (!cachedImage) {
      try {
        const blob = await repos.book.fetchImageBlob(page.imageUrl)
        await repos.book.saveLocalImage(bookId, pageNum, blob)
      }
      catch (e) {
        console.warn(`Failed to cache image for page ${pageNum}`, e)
      }
    }
  }

  try {
    await repos.book.getPageDict(bookId, pageNum)
  }
  catch (e) {
    console.warn(`Failed to fetch dictionary for page ${pageNum}`, e)
  }
}

/**
 * Общий шаг анализа текстов (предложений или слов):
 * локальный кэш → серверный кэш → пакетный LLM-анализ.
 */
async function filterServerCachedTexts(
  missingTexts: string[],
  type: 'sentence' | 'word',
  ctx: AnalysisContext,
  doneKey: 'sentencesDone' | 'wordsDone',
) {
  if (missingTexts.length === 0)
    return

  try {
    const checkItems = missingTexts.map(textItem => ({ text: textItem, type }))
    const res = await repos.analysis.checkCache(
      ctx.bookId,
      checkItems,
      ctx.language,
      ctx.signal,
    )
    const cacheMap = new Map(res.results.map(resItem => [resItem.sentence, resItem.analysis]))

    for (let j = missingTexts.length - 1; j >= 0; j--) {
      const text = missingTexts[j]
      const serverCached = cacheMap.get(text) as LlmAnalysis
      if (serverCached) {
        await repos.analysis.saveLocalAnalysis(text, serverCached)
        syncProgress.value[doneKey]++
        missingTexts.splice(j, 1)
      }
    }
  }
  catch (e) {
    const err = e as Error
    if (err.name === 'AbortError')
      throw err
  }
}

async function analyzeMissingTexts(
  texts: string[],
  type: 'sentence' | 'word',
  ctx: AnalysisContext,
  totalKey: 'sentencesTotal' | 'wordsTotal',
  doneKey: 'sentencesDone' | 'wordsDone',
  label: string,
  pageNum: number,
): Promise<void> {
  syncProgress.value[totalKey] += texts.length
  const missingTexts: string[] = []

  for (const text of texts) {
    const cached = await repos.analysis.getLocalAnalysis(text)
    if (cached) {
      syncProgress.value[doneKey]++
    }
    else {
      missingTexts.push(text)
    }
  }

  await filterServerCachedTexts(
    missingTexts,
    type,
    ctx,
    doneKey,
  )

  const batches: string[][] = []
  for (let j = 0; j < missingTexts.length; j += ctx.batchSize)
    batches.push(missingTexts.slice(j, j + ctx.batchSize))

  for (let j = 0; j < batches.length; j += ctx.concurrencyLimit) {
    if (ctx.signal.aborted)
      throw new Error('Aborted')
    const currentBatches = batches.slice(j, j + ctx.concurrencyLimit)

    await Promise.all(currentBatches.map(async (batch) => {
      const itemsToAnalyze = batch.map(t => ({ id: uuidv4(), sentence: t, type }))

      try {
        const res = await repos.analysis.analyzeBatch(
          ctx.bookId,
          itemsToAnalyze,
          ctx.language,
          ctx.signal,
        )
        for (const result of res.results) {
          const item = itemsToAnalyze.find(it => it.id === result.id)
          if (item) {
            await repos.analysis.saveLocalAnalysis(item.sentence, result.analysis)
            syncProgress.value[doneKey]++
          }
        }
      }
      catch (e) {
        const err = e as Error
        if (err.name !== 'AbortError')
          console.error(`Analyze ${type} error:`, err)
      }
    }))
    syncProgress.value.currentTask = `Анализ ${label}: стр. ${pageNum}, ${syncProgress.value[doneKey]} / ${syncProgress.value[totalKey]}`
  }
}

/** Генерирует TTS-аудио для предложений и слов страницы. */
async function generateTtsForTexts(texts: string[], ctx: AnalysisContext, pageNum: number): Promise<void> {
  syncProgress.value.ttsTotal += texts.length
  const ttsConcurrency = 3
  const settingsStore = useGlobalSettingsStore()
  const voice = settingsStore.ttsVoice || 'Kore'

  for (let j = 0; j < texts.length; j += ttsConcurrency) {
    if (ctx.signal.aborted)
      throw new Error('Aborted')
    const batch = texts.slice(j, j + ttsConcurrency)

    await Promise.all(batch.map(async (text) => {
      if (ctx.signal.aborted)
        return
      const normalizedText = text.trim().toLowerCase()
      const cacheKey = `${ctx.bookId}_${voice}_${normalizedText}`

      try {
        const cached = await repos.analysis.getLocalTts(cacheKey)
        if (!cached) {
          const res = await repos.analysis.generateTts(
            ctx.bookId,
            text,
            voice,
            ctx.signal,
          )
          await repos.analysis.saveLocalTts(cacheKey, res.audioBase64)
        }
      }
      catch (e: unknown) {
        if ((e as Error).name !== 'AbortError')
          console.error('TTS Sync error:', e)
      }

      syncProgress.value.ttsDone++
    }))
    syncProgress.value.currentTask = `Генерация аудио: стр. ${pageNum}, ${syncProgress.value.ttsDone} / ${syncProgress.value.ttsTotal}`
  }
}

/** Выполняет анализ предложений и слов на странице. */
async function processPageAnalysis(
  sentences: string[],
  words: string[],
  options: typeof syncOptions.value,
  ctx: AnalysisContext,
  pageNum: number,
): Promise<void> {
  if (options.analyzeSentences) {
    await analyzeMissingTexts(
      sentences,
      'sentence',
      ctx,
      'sentencesTotal',
      'sentencesDone',
      'предложений',
      pageNum,
    )
  }

  if (options.analyzeWords) {
    await analyzeMissingTexts(
      words,
      'word',
      ctx,
      'wordsTotal',
      'wordsDone',
      'слов',
      pageNum,
    )
  }
}

/** Генерирует TTS-аудио для предложений и слов страницы, если включено. */
async function processPageTts(
  sentences: string[],
  words: string[],
  options: typeof syncOptions.value,
  ctx: AnalysisContext,
  pageNum: number,
): Promise<void> {
  if (!options.ttsSentences && !options.ttsWords)
    return

  const ttsItems = [...(options.ttsSentences ? sentences : []), ...(options.ttsWords ? words : [])]
  await generateTtsForTexts(ttsItems, ctx, pageNum)
}

/** Обрабатывает одну страницу: кэширование, парсинг, анализ и TTS. */
async function processPage(
  book: SyncBook,
  pageNum: number,
  options: typeof syncOptions.value,
  ctx: AnalysisContext,
): Promise<void> {
  if (ctx.signal.aborted)
    throw new Error('Aborted')

  syncProgress.value.currentTask = `Загрузка страницы ${pageNum} из ${book.totalPages}`

  let page: PagePayload | null
  try {
    page = await repos.book.getPage(ctx.bookId, pageNum, true)
  }
  catch (e) {
    console.warn(`Failed to fetch page ${pageNum}`, e)

    return
  }

  await cachePageAssets(
    ctx.bookId,
    page ?? undefined,
    pageNum,
    options.cachePages,
  )
  syncProgress.value.pagesDone = pageNum

  if (!page)
    return

  const { sentences, words } = extractPageData(page, {
    extractSentences: options.analyzeSentences || options.ttsSentences,
    extractWords: options.analyzeWords || options.ttsWords,
  })

  await processPageAnalysis(
    sentences,
    words,
    options,
    ctx,
    pageNum,
  )

  await processPageTts(
    sentences,
    words,
    options,
    ctx,
    pageNum,
  )
}

async function executeBookSync(book: SyncBook, options: typeof syncOptions.value, ctx: AnalysisContext) {
  await syncBookToc(ctx.bookId)
  await cacheBookCover(book, options.cachePages)

  const needPageContent = options.cachePages || options.analyzeSentences || options.analyzeWords || options.ttsSentences || options.ttsWords

  if (needPageContent) {
    for (let i = 1; i <= book.totalPages; i++) {
      await processPage(
        book,
        i,
        options,
        ctx,
      )
    }
  }

  if (!ctx.signal.aborted) {
    syncState.value = 'finished'
    syncProgress.value.currentTask = 'Успешно завершено!'
  }
}

export async function startWholeBookSync(bookId: number, options: {
  cachePages: boolean
  analyzeSentences: boolean
  analyzeWords?: boolean
  ttsSentences?: boolean
  ttsWords?: boolean
}): Promise<void> {
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

  trackEvent('book_sync_started', { ...syncOptions.value })

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

  const ctx: AnalysisContext = {
    bookId,
    language: book.language,
    signal,
    batchSize,
    concurrencyLimit,
  }

  try {
    await executeBookSync(book, syncOptions.value, ctx)
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
