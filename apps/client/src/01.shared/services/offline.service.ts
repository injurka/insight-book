import type { Book, DictDeck, Highlight, LlmAnalysis, PageDictEntry, PagePayload, TocItem, UserDictItem } from '../types/models'
import localforage from 'localforage'
import { AppRoutePaths } from '~/01.shared/constants/routes'
import router from '~/01.shared/lib/router'
import { useToastStore } from '~/01.shared/store/toast.store'
import { useGlobalSettingsStore } from '../store/settings.store'

const MEDIA_CACHE_NAME = 'insight-book-offline-media'

localforage.config({
  name: 'InsightBook',
  storeName: 'offline_cache',
  description: 'Кэш для работы читалки в оффлайн-режиме',
})

// === L1 IN-MEMORY CACHE (RAM) ===
const L1_ANALYSIS_MAX_SIZE = 100
const l1AnalysisCache = new Map<string, LlmAnalysis>()

function buildAnalysisCacheKey(text: string, srcLang?: string): string {
  const targetLang = getAppLanguage()
  const normalizedSrc = (srcLang || 'any').toLowerCase().trim()
  const normalizedText = text.trim().toLowerCase()

  return `analysis_${normalizedSrc}_${targetLang}_${normalizedText}`
}

function buildLegacyAnalysisCacheKey(text: string): string {
  const targetLang = getAppLanguage()
  const normalizedText = text.trim().toLowerCase()

  return `analysis_${targetLang}_${normalizedText}`
}

function getL1Analysis(key: string): LlmAnalysis | null {
  if (!l1AnalysisCache.has(key))
    return null

  // Обновляем порядок (LRU)
  const val = l1AnalysisCache.get(key)!
  l1AnalysisCache.delete(key)
  l1AnalysisCache.set(key, val)

  return val
}

function setL1Analysis(key: string, analysis: LlmAnalysis): void {
  if (l1AnalysisCache.has(key)) {
    l1AnalysisCache.delete(key)
  }
  else if (l1AnalysisCache.size >= L1_ANALYSIS_MAX_SIZE) {
    // Вытесняем самую старую запись из RAM
    const oldestKey = l1AnalysisCache.keys().next().value
    if (oldestKey !== undefined) {
      l1AnalysisCache.delete(oldestKey)
    }
  }

  l1AnalysisCache.set(key, analysis)
}

function getKey(key: string) {
  const uid = localStorage.getItem('insight_uid') || '1'

  return `u${uid}_${key}`
}

function getAppLanguage() {
  if (getActivePinia())
    return useGlobalSettingsStore().appLanguage

  try {
    const saved = localStorage.getItem('global-app-language')
    if (saved)
      return JSON.parse(saved)
  }
  catch { }

  return 'ru'
}

async function getMediaCache(): Promise<Cache | null> {
  if (typeof window !== 'undefined' && 'caches' in window) {
    try {
      return await caches.open(MEDIA_CACHE_NAME)
    }
    catch (e) {
      console.warn('[OfflineService] Failed to open MediaCache:', e)

      return null
    }
  }

  return null
}

function isCacheLostError(err: unknown): boolean {
  return err instanceof DOMException && err.name === 'NotReadableError'
}

/**
 * Безопасный cache.match: если браузер потерял файл записи кэша
 * (NotReadableError — «Data lost due to missing file»), запись невосстановима
 * и остаётся в индексе, отравляя каждый вызов. Удаляем её и возвращаем null.
 */
async function safeCacheMatch(cache: Cache, req: RequestInfo | URL): Promise<Response | null> {
  try {
    return (await cache.match(req)) ?? null
  }
  catch (err) {
    if (isCacheLostError(err)) {
      try {
        await cache.delete(req)
        console.warn(`[OfflineService] Удалена битая запись кэша: ${req}`)
      }
      catch (deleteErr) {
        console.warn('[OfflineService] Не удалось удалить битую запись кэша:', deleteErr)
      }
    }
    else {
      console.warn('[OfflineService] cache.match failed:', err)
    }

    return null
  }
}

/**
 * Безопасный cache.put: если в индексе есть битая запись с тем же URL,
 * put падает с NotReadableError. Удаляем запись и пробуем один раз заново.
 * Возвращает false, если записать не удалось (вызывающий код уходит в legacy-fallback).
 */
async function safeCachePut(cache: Cache, req: RequestInfo | URL, response: Response): Promise<boolean> {
  const retryResponse = response.clone()

  try {
    await cache.put(req, response)

    return true
  }
  catch (err) {
    if (isCacheLostError(err)) {
      try {
        await cache.delete(req)
      }
      catch { }

      try {
        await cache.put(req, retryResponse)

        return true
      }
      catch (retryErr) {
        console.warn('[OfflineService] cache.put failed after cleanup:', retryErr)

        return false
      }
    }

    console.warn('[OfflineService] cache.put failed:', err)

    return false
  }
}

export interface BookCacheStat {
  title: string
  totalPages: number
  cachedPages: number[]
  analysesCount: number
  sizeBytes: number
  imagesCount: number
  ttsCount: number
  dictPagesCount: number
}

function handleBookPageOrDictKey(key: string, itemSize: number, bookStats: Record<number, BookCacheStat>) {
  if (key.includes('_page_') && !key.endsWith('_dict')) {
    const bookId = Number(key.split('_')[1])
    const pageNum = Number(key.split('_')[3])
    if (bookStats[bookId]) {
      if (!bookStats[bookId].cachedPages.includes(pageNum))
        bookStats[bookId].cachedPages.push(pageNum)
      bookStats[bookId].sizeBytes += itemSize
    }

    return true
  }

  if (key.endsWith('_dict')) {
    const bookId = Number(key.split('_')[1])
    if (bookStats[bookId]) {
      bookStats[bookId].sizeBytes += itemSize
      bookStats[bookId].dictPagesCount++
    }

    return true
  }

  return false
}

function handleImageKey(key: string, itemSize: number, bookStats: Record<number, BookCacheStat>) {
  const bookId = Number(key.split('_')[1])
  if (bookStats[bookId]) {
    bookStats[bookId].sizeBytes += itemSize
    bookStats[bookId].imagesCount++
  }
}

function handleCoverKey(key: string, itemSize: number, bookStats: Record<number, BookCacheStat>) {
  const bookId = Number(key.replace('cover_', ''))
  if (bookStats[bookId])
    bookStats[bookId].sizeBytes += itemSize
}

function handleTtsKey(key: string, itemSize: number, bookStats: Record<number, BookCacheStat>) {
  const hashParts = key.replace('tts_', '').split('_')
  const bookId = Number(hashParts[0])
  if (!Number.isNaN(bookId) && bookStats[bookId]) {
    bookStats[bookId].sizeBytes += itemSize
    bookStats[bookId].ttsCount++
  }
}

function handleBookMetaKey(key: string, itemSize: number, bookStats: Record<number, BookCacheStat>) {
  const bookId = Number(key.split('_')[2])
  if (bookStats[bookId])
    bookStats[bookId].sizeBytes += itemSize
}

function handleOtherLocalForageKeys(key: string, itemSize: number, bookStats: Record<number, BookCacheStat>) {
  if (key.startsWith('image_')) {
    handleImageKey(key, itemSize, bookStats)
  }
  else if (key.startsWith('cover_')) {
    handleCoverKey(key, itemSize, bookStats)
  }
  else if (key.startsWith('tts_')) {
    handleTtsKey(key, itemSize, bookStats)
  }
  else if (key.startsWith('book_info_') || key.startsWith('book_toc_') || key.startsWith('book_highlights_')) {
    handleBookMetaKey(key, itemSize, bookStats)
  }
}

function processLocalForageKey(key: string, itemSize: number, bookStats: Record<number, BookCacheStat>) {
  if (key.startsWith('book_')) {
    if (handleBookPageOrDictKey(key, itemSize, bookStats))
      return
  }

  handleOtherLocalForageKeys(key, itemSize, bookStats)
}

function handleMediaCacheImageOrCover(
  type: string,
  pathParts: string[],
  size: number,
  bookStats: Record<number, BookCacheStat>,
) {
  const bookId = Number(pathParts[3])
  if (bookStats[bookId]) {
    bookStats[bookId].sizeBytes += size
    if (type === 'image')
      bookStats[bookId].imagesCount++
  }
}

function handleMediaCacheTts(pathParts: string[], size: number, bookStats: Record<number, BookCacheStat>) {
  if (pathParts[3]?.includes('_')) {
    const bookId = Number(pathParts[3].split('_')[0])
    if (!Number.isNaN(bookId) && bookStats[bookId]) {
      bookStats[bookId].sizeBytes += size
      bookStats[bookId].ttsCount++
    }
  }
}

async function processMediaCacheReq(cache: Cache, req: Request, bookStats: Record<number, BookCacheStat>): Promise<number> {
  const url = new URL(req.url)
  const pathParts = url.pathname.split('/')
  const type = pathParts[2]

  const res = await safeCacheMatch(cache, req)
  const size = res ? Number(res.headers.get('content-length') || 0) : 0

  if (type === 'image' || type === 'cover') {
    handleMediaCacheImageOrCover(
      type,
      pathParts,
      size,
      bookStats,
    )
  }
  else if (type === 'tts') {
    handleMediaCacheTts(pathParts, size, bookStats)
  }

  return size
}

/** Проверяет, относится ли URL записи медиа-кэша к указанной книге. */
function isBookMediaEntry(url: string, bookId: number): boolean {
  const pathParts = new URL(url).pathname.split('/')
  const type = pathParts[2]

  if (type === 'image' || type === 'cover')
    return Number(pathParts[3]) === bookId

  if (type === 'tts') {
    const hashKey = pathParts[3]

    return !!hashKey && hashKey.startsWith(`${bookId}_`)
  }

  return false
}

/** Сносит медиа-кэш целиком (последнее средство при нечитаемом индексе). */
async function deleteWholeMediaCache(): Promise<void> {
  try {
    await caches.delete(MEDIA_CACHE_NAME)
  }
  catch (deleteErr) {
    console.warn('[OfflineService] Не удалось удалить медиа-кэш:', deleteErr)
  }
}

/**
 * Считает суммарный размер записей медиа-кэша (Cache API).
 * Если индекс кэша нечитаем (потеряны файлы записей) — сносит кэш целиком
 * и возвращает 0, чтобы не ломать загрузку статистики.
 */
async function collectMediaCacheStats(bookStats: Record<number, BookCacheStat>): Promise<number> {
  const cache = await getMediaCache()
  if (!cache)
    return 0

  let totalSize = 0

  try {
    const cacheKeys = await cache.keys()
    for (const req of cacheKeys) {
      const size = await processMediaCacheReq(cache, req, bookStats)
      totalSize += size
    }
  }
  catch (err) {
    if (isCacheLostError(err)) {
      await deleteWholeMediaCache()
      console.warn('[OfflineService] Медиа-кэш повреждён, сброшен целиком:', err)
    }
    else {
      console.warn('[OfflineService] Не удалось посчитать медиа-кэш:', err)
    }
  }

  return totalSize
}

/** Удаляет из медиа-кэша записи, относящиеся к книге. */
async function clearMediaCacheForBook(bookId: number): Promise<void> {
  const cache = await getMediaCache()
  if (!cache)
    return

  try {
    const cacheKeys = await cache.keys()
    for (const req of cacheKeys) {
      if (isBookMediaEntry(req.url, bookId))
        await cache.delete(req)
    }
  }
  catch (err) {
    if (isCacheLostError(err)) {
      await deleteWholeMediaCache()
      console.warn('[OfflineService] Медиа-кэш повреждён, сброшен целиком:', err)
    }
    else {
      console.warn('[OfflineService] Не удалось очистить медиа-кэш:', err)
    }
  }
}

async function safeSetItem<T>(key: string, value: T): Promise<void> {
  try {
    await localforage.setItem(getKey(key), value)
  }
  catch (e) {
    const err = e as Error
    if (err.name === 'QuotaExceededError' || err.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
      const toast = useToastStore()
      toast.error('Память устройства переполнена! Очистите кэш.', {
        expire: 8000,
        action: {
          label: 'Очистить кэш',
          onClick: () => {
            router.push(AppRoutePaths.Settings)
          },
        },
      })
    }
  }
}

async function safeGetItem<T>(key: string): Promise<T | null> {
  try {
    return await localforage.getItem<T>(getKey(key))
  }
  catch (e) {
    console.error(`[OfflineService] Error reading from localForage (key: ${key}):`, e)
    try {
      await localforage.removeItem(getKey(key))
    }
    catch (removeErr) {
      console.warn(`[OfflineService] Failed to remove corrupted item (key: ${key}):`, removeErr)
    }

    return null
  }
}

export const offlineService = {

  async savePage(bookId: number, pageNum: number, payload: PagePayload) {
    await safeSetItem(`book_${bookId}_page_${pageNum}`, JSON.parse(JSON.stringify(payload)))
  },

  async getPage(bookId: number, pageNum: number): Promise<PagePayload | null> {
    return safeGetItem(`book_${bookId}_page_${pageNum}`)
  },

  async saveImage(bookId: number, pageNum: number, blob: Blob) {
    const cache = await getMediaCache()
    if (cache) {
      const saved = await safeCachePut(cache, `/offline/image/${bookId}/${pageNum}`, new Response(blob, {
        headers: {
          'Content-Type': blob.type,
          'Content-Length': blob.size.toString(),
        },
      }))
      if (saved)
        return
    }

    // Legacy fallback (нет Cache API или запись не удалась)
    await safeSetItem(`image_${bookId}_${pageNum}`, blob)
  },

  async getImage(bookId: number, pageNum: number): Promise<Blob | null> {
    const cache = await getMediaCache()
    if (cache) {
      const res = await safeCacheMatch(cache, `/offline/image/${bookId}/${pageNum}`)
      if (res)
        return res.blob()
    }

    return safeGetItem<Blob>(`image_${bookId}_${pageNum}`)
  },

  async saveCover(bookId: number, blob: Blob) {
    const cache = await getMediaCache()
    if (cache) {
      const saved = await safeCachePut(cache, `/offline/cover/${bookId}`, new Response(blob, {
        headers: {
          'Content-Type': blob.type,
          'Content-Length': blob.size.toString(),
        },
      }))
      if (saved)
        return
    }

    await safeSetItem(`cover_${bookId}`, blob)
  },

  async getCover(bookId: number): Promise<Blob | null> {
    const cache = await getMediaCache()
    if (cache) {
      const res = await safeCacheMatch(cache, `/offline/cover/${bookId}`)
      if (res)
        return res.blob()
    }

    return safeGetItem<Blob>(`cover_${bookId}`)
  },

  async savePageDictionary(bookId: number, pageNum: number, dict: Record<string, PageDictEntry>) {
    await safeSetItem(`book_${bookId}_page_${pageNum}_dict`, JSON.parse(JSON.stringify(dict)))
  },

  async getPageDictionary(bookId: number, pageNum: number): Promise<Record<string, PageDictEntry> | null> {
    return safeGetItem(`book_${bookId}_page_${pageNum}_dict`)
  },

  async saveBookInfo(bookId: number, info: Book) {
    await safeSetItem(`book_info_${bookId}`, JSON.parse(JSON.stringify(info)))
  },

  async getBookInfo(bookId: number): Promise<Book | null> {
    return safeGetItem(`book_info_${bookId}`)
  },

  async saveBooksList(books: Book[]) {
    await safeSetItem('library_books_list', JSON.parse(JSON.stringify(books)))
  },

  async getBooksList(): Promise<Book[] | null> {
    return safeGetItem('library_books_list')
  },

  async saveToc(bookId: number, toc: TocItem[]) {
    await safeSetItem(`book_toc_${bookId}`, JSON.parse(JSON.stringify(toc)))
  },

  async getToc(bookId: number): Promise<TocItem[] | null> {
    return safeGetItem(`book_toc_${bookId}`)
  },

  async saveHighlights(bookId: number, highlights: Highlight[]) {
    await safeSetItem(`book_highlights_${bookId}`, JSON.parse(JSON.stringify(highlights)))
  },

  async getHighlights(bookId: number): Promise<Highlight[] | null> {
    return safeGetItem(`book_highlights_${bookId}`)
  },

  async saveDictionary(words: UserDictItem[]) {
    const lang = getAppLanguage()
    await safeSetItem(`dictionary_words_${lang}`, JSON.parse(JSON.stringify(words)))
  },

  async getDictionary(): Promise<UserDictItem[] | null> {
    const lang = getAppLanguage()

    return safeGetItem(`dictionary_words_${lang}`)
  },

  async saveDecks(decks: DictDeck[]) {
    const lang = getAppLanguage()
    await safeSetItem(`dictionary_decks_${lang}`, JSON.parse(JSON.stringify(decks)))
  },

  async getDecks(): Promise<DictDeck[] | null> {
    const lang = getAppLanguage()

    return safeGetItem(`dictionary_decks_${lang}`)
  },

  async saveAnalysis(text: string, analysis: LlmAnalysis, srcLang?: string) {
    if (!text || !analysis)
      return

    const key = buildAnalysisCacheKey(text, srcLang)

    // L1: Запись в оперативную память (RAM)
    setL1Analysis(key, analysis)

    // L2: Запись в IndexedDB
    await safeSetItem(key, JSON.parse(JSON.stringify(analysis)))
  },

  async getAnalysis(text: string, srcLang?: string): Promise<LlmAnalysis | null> {
    if (!text)
      return null

    const key = buildAnalysisCacheKey(text, srcLang)

    // 1. Проверяем L1-кэш в RAM (0.0001 мс)
    const l1Hit = getL1Analysis(key)
    if (l1Hit)
      return l1Hit

    // 2. Проверяем L2-кэш в IndexedDB по новому ключу (с srcLang)
    let cached = await safeGetItem<LlmAnalysis>(key)

    // 3. Fallback: проверяем L2-кэш по старому ключу для обратной совместимости
    if (!cached && srcLang) {
      const legacyKey = buildLegacyAnalysisCacheKey(text)
      cached = await safeGetItem<LlmAnalysis>(legacyKey)
    }

    // Если нашли в L2 — кладём в L1 в оперативной памяти для следующих мгновенных обращений
    if (cached) {
      setL1Analysis(key, cached)
    }

    return cached
  },

  async saveTts(hashKey: string, audioBase64: string) {
    const binaryString = window.atob(audioBase64)
    const bytes = new Uint8Array(binaryString.length)
    for (let i = 0; i < binaryString.length; i++)
      bytes[i] = binaryString.charCodeAt(i)

    const blob = new Blob([bytes], { type: 'audio/ogg' })

    const cache = await getMediaCache()
    if (cache) {
      const saved = await safeCachePut(cache, `/offline/tts/${hashKey}`, new Response(blob, {
        headers: {
          'Content-Type': 'audio/ogg',
          'Content-Length': blob.size.toString(),
        },
      }))
      if (saved)
        return
    }

    await safeSetItem(`tts_${hashKey}`, audioBase64)
  },

  async getTtsBlob(hashKey: string): Promise<Blob | null> {
    const cache = await getMediaCache()
    if (cache) {
      const res = await safeCacheMatch(cache, `/offline/tts/${hashKey}`)
      if (res)
        return res.blob()
    }

    const base64 = await safeGetItem<string>(`tts_${hashKey}`)
    if (base64) {
      const binaryString = window.atob(base64)
      const bytes = new Uint8Array(binaryString.length)
      for (let i = 0; i < binaryString.length; i++)
        bytes[i] = binaryString.charCodeAt(i)

      return new Blob([bytes], { type: 'audio/ogg' })
    }

    return null
  },

  // === МЕТОДЫ ДЛЯ МЕНЕДЖЕРА КЭША ===
  async getStorageEstimate(): Promise<{ usage: number, quota: number } | null> {
    if (navigator.storage && navigator.storage.estimate) {
      try {
        const estimate = await navigator.storage.estimate()

        return { usage: estimate.usage || 0, quota: estimate.quota || 0 }
      }
      catch { return null }
    }

    return null
  },

  async requestPersistentStorage(): Promise<boolean> {
    if (navigator.storage && navigator.storage.persist) {
      try {
        return await navigator.storage.persist()
      }
      catch {
        return false
      }
    }

    return false
  },

  async getCacheStats() {
    const keys = await localforage.keys()
    const prefix = getKey('')

    const userKeys = keys.filter(keyItem => keyItem.startsWith(prefix))
    const booksList = await this.getBooksList() || []
    const bookStats: Record<number, BookCacheStat> = {}

    booksList.forEach((bookItem) => {
      bookStats[bookItem.id] = {
        title: bookItem.title,
        totalPages: bookItem.totalPages || 0,
        cachedPages: [],
        analysesCount: bookItem.analysesCount || 0,
        sizeBytes: 0,
        imagesCount: 0,
        ttsCount: 0,
        dictPagesCount: 0,
      }
    })

    let totalDictionaryWords = 0
    let totalSize = 0

    for (const fullKey of userKeys) {
      const key = fullKey.replace(prefix, '')
      const item = await localforage.getItem(fullKey)
      const itemSize = item instanceof Blob ? item.size : (item ? JSON.stringify(item).length : 0)
      totalSize += itemSize

      if (key.startsWith('dictionary_words_')) {
        totalDictionaryWords += Array.isArray(item) ? item.length : 0
      }
      else {
        processLocalForageKey(key, itemSize, bookStats)
      }
    }

    totalSize += await collectMediaCacheStats(bookStats)

    return { bookStats, totalDictionaryWords, totalSizeBytes: totalSize }
  },

  async clearBookCache(bookId: number) {
    // 1. Очистка старого IndexedDB хранилища
    const keys = await localforage.keys()
    const prefix = getKey('')

    const keysToRemove = keys.filter((fullKey) => {
      if (!fullKey.startsWith(prefix))
        return false

      const key = fullKey.replace(prefix, '')

      return key.startsWith(`book_${bookId}_page_`) || key === `book_info_${bookId}` || key === `book_toc_${bookId}` || key === `book_highlights_${bookId}` || key.startsWith(`image_${bookId}_`) || key === `cover_${bookId}` || key.startsWith(`tts_${bookId}_`)
    })

    for (const key of keysToRemove)
      await localforage.removeItem(key)

    // 2. Очистка Cache API
    await clearMediaCacheForBook(bookId)
  },
}
