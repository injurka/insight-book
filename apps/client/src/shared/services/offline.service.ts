import type { Book, PagePayload, TocItem, UserDictItem } from '../types/models'
import localforage from 'localforage'

localforage.config({
  name: 'InsightBook',
  storeName: 'offline_cache',
  description: 'Кэш для работы читалки в оффлайн-режиме',
})

export const offlineService = {
  async savePage(bookId: number, pageNum: number, payload: PagePayload) {
    await localforage.setItem(`book_${bookId}_page_${pageNum}`, JSON.parse(JSON.stringify(payload)))
  },

  async getPage(bookId: number, pageNum: number): Promise<PagePayload | null> {
    return await localforage.getItem(`book_${bookId}_page_${pageNum}`)
  },

  async saveBookInfo(bookId: number, info: Book) {
    await localforage.setItem(`book_info_${bookId}`, JSON.parse(JSON.stringify(info)))
  },

  async getBookInfo(bookId: number): Promise<Book | null> {
    return await localforage.getItem(`book_info_${bookId}`)
  },

  async saveBooksList(books: Book[]) {
    await localforage.setItem('library_books_list', JSON.parse(JSON.stringify(books)))
  },

  async getBooksList(): Promise<Book[] | null> {
    return await localforage.getItem('library_books_list')
  },

  async saveToc(bookId: number, toc: TocItem[]) {
    await localforage.setItem(`book_toc_${bookId}`, JSON.parse(JSON.stringify(toc)))
  },

  async getToc(bookId: number): Promise<TocItem[] | null> {
    return await localforage.getItem(`book_toc_${bookId}`)
  },

  async saveDictionary(words: UserDictItem[]) {
    await localforage.setItem('dictionary_words', JSON.parse(JSON.stringify(words)))
  },

  async getDictionary(): Promise<UserDictItem[] | null> {
    return await localforage.getItem('dictionary_words')
  },
}
