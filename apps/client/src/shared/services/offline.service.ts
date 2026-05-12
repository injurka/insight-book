import type { Book, LlmAnalysis, PagePayload, TocItem, UserDictItem } from '../types/models'
import localforage from 'localforage'
import { useToastStore } from '~/shared/store/toast.store'

localforage.config({
  name: 'InsightBook',
  storeName: 'offline_cache',
  description: 'Кэш для работы читалки в оффлайн-режиме',
})

/**
 * Безопасное сохранение в IndexedDB с перехватом ошибки переполнения памяти
 */
async function safeSetItem<T>(key: string, value: T): Promise<void> {
  try {
    await localforage.setItem(key, value)
  }
  catch (e: any) {
    if (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
      console.error('ОШИБКА: Память браузера переполнена!', e)
      const toast = useToastStore()
      toast.error(
        'Память устройства переполнена! Пожалуйста, перейдите в настройки и очистите кэш старых книг.',
        { expire: 8000 },
      )
    }
    else {
      console.error(`Ошибка при сохранении ключа ${key} в localforage:`, e)
    }
  }
}

export const offlineService = {
  // === БАЗОВЫЕ МЕТОДЫ КЭШИРОВАНИЯ ===

  async savePage(bookId: number, pageNum: number, payload: PagePayload) {
    await safeSetItem(`book_${bookId}_page_${pageNum}`, JSON.parse(JSON.stringify(payload)))
  },

  async getPage(bookId: number, pageNum: number): Promise<PagePayload | null> {
    return await localforage.getItem(`book_${bookId}_page_${pageNum}`)
  },

  async saveBookInfo(bookId: number, info: Book) {
    await safeSetItem(`book_info_${bookId}`, JSON.parse(JSON.stringify(info)))
  },

  async getBookInfo(bookId: number): Promise<Book | null> {
    return await localforage.getItem(`book_info_${bookId}`)
  },

  async saveBooksList(books: Book[]) {
    await safeSetItem('library_books_list', JSON.parse(JSON.stringify(books)))
  },

  async getBooksList(): Promise<Book[] | null> {
    return await localforage.getItem('library_books_list')
  },

  async saveToc(bookId: number, toc: TocItem[]) {
    await safeSetItem(`book_toc_${bookId}`, JSON.parse(JSON.stringify(toc)))
  },

  async getToc(bookId: number): Promise<TocItem[] | null> {
    return await localforage.getItem(`book_toc_${bookId}`)
  },

  async saveDictionary(words: UserDictItem[]) {
    await safeSetItem('dictionary_words', JSON.parse(JSON.stringify(words)))
  },

  async getDictionary(): Promise<UserDictItem[] | null> {
    return await localforage.getItem('dictionary_words')
  },

  async saveAnalysis(bookId: number, text: string, analysis: LlmAnalysis) {
    await safeSetItem(`analysis_${bookId}_${text}`, JSON.parse(JSON.stringify(analysis)))
  },

  async getAnalysis(bookId: number, text: string): Promise<LlmAnalysis | null> {
    return await localforage.getItem(`analysis_${bookId}_${text}`)
  },

  // === МЕТОДЫ ДЛЯ МЕНЕДЖЕРА КЭША ===

  /**
   * Получение статистики по занятому месту (браузерная квота)
   */
  async getStorageEstimate(): Promise<{ usage: number, quota: number } | null> {
    if (navigator.storage && navigator.storage.estimate) {
      try {
        const estimate = await navigator.storage.estimate()
        return {
          usage: estimate.usage || 0,
          quota: estimate.quota || 0,
        }
      }
      catch (e) {
        console.error('Ошибка получения квоты хранилища', e)
        return null
      }
    }
    return null
  },

  /**
   * Запрос на защиту хранилища от автоматической очистки браузером (iOS / Android)
   */
  async requestPersistentStorage(): Promise<boolean> {
    if (navigator.storage && navigator.storage.persist) {
      return await navigator.storage.persist()
    }
    return false
  },

  /**
   * Сбор детальной статистики по конкретным книгам
   */
  async getCacheStats() {
    const keys = await localforage.keys()
    const booksList = await this.getBooksList() || []

    const bookStats: Record<number, { title: string, totalPages: number, cachedPages: number[], analysesCount: number, sizeBytes: number }> = {}

    booksList.forEach((b) => {
      bookStats[b.id] = {
        title: b.title,
        totalPages: b.totalPages || 0,
        cachedPages: [],
        analysesCount: 0,
        sizeBytes: 0,
      }
    })

    let totalDictionaryWords = 0
    let totalSize = 0

    for (const key of keys) {
      const item = await localforage.getItem(key)
      const itemSize = item ? JSON.stringify(item).length : 0
      totalSize += itemSize

      if (key === 'dictionary_words') {
        totalDictionaryWords = Array.isArray(item) ? item.length : 0
      }
      else if (key.startsWith('book_') && key.includes('_page_')) {
        const bookId = Number(key.split('_')[1])
        const pageNum = Number(key.split('_')[3])
        if (bookStats[bookId]) {
          bookStats[bookId].cachedPages.push(pageNum)
          bookStats[bookId].sizeBytes += itemSize
        }
      }
      else if (key.startsWith('analysis_')) {
        const bookId = Number(key.split('_')[1])
        if (bookStats[bookId]) {
          bookStats[bookId].analysesCount++
          bookStats[bookId].sizeBytes += itemSize
        }
      }
      else if (key.startsWith('book_info_') || key.startsWith('book_toc_')) {
        const bookId = Number(key.split('_')[2])
        if (bookStats[bookId]) {
          bookStats[bookId].sizeBytes += itemSize
        }
      }
    }

    Object.values(bookStats).forEach((stat) => {
      stat.cachedPages.sort((a, b) => a - b)
    })

    return {
      bookStats,
      totalDictionaryWords,
      totalSizeBytes: totalSize,
    }
  },

  async clearBookCache(bookId: number) {
    const keys = await localforage.keys()
    const keysToRemove = keys.filter(key =>
      key.startsWith(`book_${bookId}_page_`)
      || key.startsWith(`analysis_${bookId}_`)
      || key === `book_info_${bookId}`
      || key === `book_toc_${bookId}`,
    )

    for (const key of keysToRemove) {
      await localforage.removeItem(key)
    }
  },
}
