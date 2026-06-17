import type { Book, DictDeck, LlmAnalysis, PageDictEntry, PagePayload, TocItem, UserDictItem } from '../types/models'
import localforage from 'localforage'
import { AppRoutePaths } from '~/shared/constants/routes'
import router from '~/shared/lib/router'
import { useToastStore } from '~/shared/store/toast.store'
import { useGlobalSettingsStore } from '../store/settings.store'

localforage.config({
  name: 'InsightBook',
  storeName: 'offline_cache',
  description: 'Кэш для работы читалки в оффлайн-режиме',
})

function getKey(key: string) {
  const uid = localStorage.getItem('insight_uid') || '1'
  return `u${uid}_${key}`
}

function getAppLanguage() {
  if (getActivePinia()) {
    return useGlobalSettingsStore().appLanguage
  }

  try {
    const saved = localStorage.getItem('global-app-language')
    if (saved)
      return JSON.parse(saved)
  }
  catch { }

  return 'ru'
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
  return await localforage.getItem<T>(getKey(key))
}

export const offlineService = {
  // === БАЗОВЫЕ МЕТОДЫ КЭШИРОВАНИЯ ===

  async savePage(bookId: number, pageNum: number, payload: PagePayload) {
    await safeSetItem(`book_${bookId}_page_${pageNum}`, JSON.parse(JSON.stringify(payload)))
  },

  async getPage(bookId: number, pageNum: number): Promise<PagePayload | null> {
    return await safeGetItem(`book_${bookId}_page_${pageNum}`)
  },

  async saveImage(bookId: number, pageNum: number, blob: Blob) {
    await safeSetItem(`image_${bookId}_${pageNum}`, blob)
  },

  async getImage(bookId: number, pageNum: number): Promise<Blob | null> {
    return await safeGetItem<Blob>(`image_${bookId}_${pageNum}`)
  },

  async saveCover(bookId: number, blob: Blob) {
    await safeSetItem(`cover_${bookId}`, blob)
  },

  async getCover(bookId: number): Promise<Blob | null> {
    return await safeGetItem<Blob>(`cover_${bookId}`)
  },

  async savePageDictionary(bookId: number, pageNum: number, dict: Record<string, PageDictEntry>) {
    await safeSetItem(`book_${bookId}_page_${pageNum}_dict`, JSON.parse(JSON.stringify(dict)))
  },

  async getPageDictionary(bookId: number, pageNum: number): Promise<Record<string, PageDictEntry> | null> {
    return await safeGetItem(`book_${bookId}_page_${pageNum}_dict`)
  },

  async saveBookInfo(bookId: number, info: Book) {
    await safeSetItem(`book_info_${bookId}`, JSON.parse(JSON.stringify(info)))
  },

  async getBookInfo(bookId: number): Promise<Book | null> {
    return await safeGetItem(`book_info_${bookId}`)
  },

  async saveBooksList(books: Book[]) {
    await safeSetItem('library_books_list', JSON.parse(JSON.stringify(books)))
  },

  async getBooksList(): Promise<Book[] | null> {
    return await safeGetItem('library_books_list')
  },

  async saveToc(bookId: number, toc: TocItem[]) {
    await safeSetItem(`book_toc_${bookId}`, JSON.parse(JSON.stringify(toc)))
  },

  async getToc(bookId: number): Promise<TocItem[] | null> {
    return await safeGetItem(`book_toc_${bookId}`)
  },

  async saveDictionary(words: UserDictItem[]) {
    const lang = getAppLanguage()
    await safeSetItem(`dictionary_words_${lang}`, JSON.parse(JSON.stringify(words)))
  },

  async getDictionary(): Promise<UserDictItem[] | null> {
    const lang = getAppLanguage()
    return await safeGetItem(`dictionary_words_${lang}`)
  },

  async saveDecks(decks: DictDeck[]) {
    const lang = getAppLanguage()
    await safeSetItem(`dictionary_decks_${lang}`, JSON.parse(JSON.stringify(decks)))
  },

  async getDecks(): Promise<DictDeck[] | null> {
    const lang = getAppLanguage()
    return await safeGetItem(`dictionary_decks_${lang}`)
  },

  async saveAnalysis(text: string, analysis: LlmAnalysis) {
    const lang = getAppLanguage()
    await safeSetItem(`analysis_${lang}_${text.trim().toLowerCase()}`, JSON.parse(JSON.stringify(analysis)))
  },

  async getAnalysis(text: string): Promise<LlmAnalysis | null> {
    const lang = getAppLanguage()
    return await safeGetItem(`analysis_${lang}_${text.trim().toLowerCase()}`)
  },

  async saveTts(hashKey: string, audioBase64: string) {
    await safeSetItem(`tts_${hashKey}`, audioBase64)
  },

  async getTts(hashKey: string): Promise<string | null> {
    return await safeGetItem(`tts_${hashKey}`)
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
      return await navigator.storage.persist()
    }
    return false
  },

  async getCacheStats() {
    const keys = await localforage.keys()
    const prefix = getKey('') // "u1_"

    const userKeys = keys.filter(k => k.startsWith(prefix))

    const booksList = await this.getBooksList() || []
    const bookStats: Record<number, any> = {}

    booksList.forEach((b) => {
      bookStats[b.id] = { title: b.title, totalPages: b.totalPages || 0, cachedPages: [], analysesCount: b.analysesCount || 0, sizeBytes: 0 }
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
      else if (key.startsWith('book_') && key.includes('_page_') && !key.endsWith('_dict')) {
        const bookId = Number(key.split('_')[1])
        const pageNum = Number(key.split('_')[3])
        if (bookStats[bookId]) {
          if (!bookStats[bookId].cachedPages.includes(pageNum)) {
            bookStats[bookId].cachedPages.push(pageNum)
          }
          bookStats[bookId].sizeBytes += itemSize
        }
      }
      else if (key.startsWith('book_') && key.endsWith('_dict')) {
        const bookId = Number(key.split('_')[1])
        if (bookStats[bookId]) {
          bookStats[bookId].sizeBytes += itemSize
        }
      }
      else if (key.startsWith('image_')) {
        const bookId = Number(key.split('_')[1])
        if (bookStats[bookId])
          bookStats[bookId].sizeBytes += itemSize
      }
      else if (key.startsWith('cover_')) {
        const bookId = Number(key.replace('cover_', ''))
        if (bookStats[bookId])
          bookStats[bookId].sizeBytes += itemSize
      }
      else if (key.startsWith('book_info_') || key.startsWith('book_toc_')) {
        const bookId = Number(key.split('_')[2])
        if (bookStats[bookId]) {
          bookStats[bookId].sizeBytes += itemSize
        }
      }
    }

    return { bookStats, totalDictionaryWords, totalSizeBytes: totalSize }
  },

  async clearBookCache(bookId: number) {
    const keys = await localforage.keys()
    const prefix = getKey('')

    const keysToRemove = keys.filter((fullKey) => {
      if (!fullKey.startsWith(prefix))
        return false

      const key = fullKey.replace(prefix, '')

      return key.startsWith(`book_${bookId}_page_`) || key === `book_info_${bookId}` || key === `book_toc_${bookId}` || key.startsWith(`image_${bookId}_`) || key === `cover_${bookId}`
    })

    for (const key of keysToRemove) {
      await localforage.removeItem(key)
    }
  },
}
