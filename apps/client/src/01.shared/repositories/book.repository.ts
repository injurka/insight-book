import type { Book, BookStats, PageDictEntry, PagePayload, TocItem } from '~/01.shared/types/models'
import { z } from 'zod'
import { applyAcl } from '~/01.shared/lib/acl'
import { api } from '~/01.shared/services/api.service'
import { offlineService } from '~/01.shared/services/offline.service'
import { useAuthStore } from '~/01.shared/store/auth.store'
import { BookSchema, TocItemSchema } from '~/01.shared/types/schemas/book.schema'

export interface IBookRepository {
  list: () => Promise<Book[]>
  getPublic: (query: string) => Promise<{ data: Book[], total: number, page: number, limit: number }>
  getInfo: (id: number) => Promise<Book | null>
  startReading: (id: number) => Promise<{ success: boolean }>
  updateInfo: (id: number, data: Partial<Book>) => Promise<{ success: boolean }>
  analyzeBook: (id: number) => Promise<{ success: boolean, stats: Book['stats'] }>
  analyzeVocabulary: (id: number) => Promise<{ success: boolean, lexicalStats: Pick<BookStats, 'posDistribution' | 'topWords' | 'lexicalDiversity'> }>
  updateCover: (id: number, file: File) => Promise<{ success: boolean, coverUrl: string }>
  updateStats: (id: number, data: Partial<BookStats>) => Promise<{ success: boolean, stats: BookStats }>
  upload: (file: File) => Promise<{ success: boolean, book: Book }>
  createCustomManga: (params: { title: string, author?: string | null, language: string, type: string }) => Promise<{ success: boolean, book: Book }>
  appendMangaChapter: (bookId: number, fd: FormData) => Promise<{ success: boolean, book: Book }>
  delete: (id: number) => Promise<{ success: boolean }>

  // Offline specific methods for manual cache sync
  saveLocalBookInfo: (id: number, info: Book) => Promise<void>

  getToc: (id: number) => Promise<TocItem[]>
  getPage: (id: number, num: number, isSync?: boolean) => Promise<PagePayload | null>
  getPageDict: (id: number, num: number) => Promise<Record<string, PageDictEntry>>
  saveLocalPageDictionary: (id: number, num: number, data: Record<string, PageDictEntry>) => Promise<void>
  getLocalImage: (bookId: number, pageNum: number) => Promise<Blob | null | undefined>
  saveLocalPage: (id: number, num: number, data: PagePayload) => Promise<void>
  fetchImageBlob: (url: string) => Promise<Blob>
  saveLocalImage: (bookId: number, pageNum: number, blob: Blob) => Promise<void>
  getLocalCover: (bookId: number) => Promise<Blob | null | undefined>
  saveLocalCover: (bookId: number, blob: Blob) => Promise<void>
  saveLocalToc: (bookId: number, toc: TocItem[]) => Promise<void>
}

export class DefaultBookRepository implements IBookRepository {
  async list(): Promise<Book[]> {
    const authStore = useAuthStore()
    if (!authStore.user && !authStore.isSingleMode) {
      return []
    }

    try {
      const raw = await api.books.list()
      const data = applyAcl(z.array(BookSchema), raw, 'book.list()')
      await offlineService.saveBooksList(data).catch(() => {})

      return data
    }
    catch (error) {
      const offlineData = await offlineService.getBooksList()
      if (offlineData)
        return applyAcl(z.array(BookSchema), offlineData, 'book.list() [offline]')

      throw error
    }
  }

  async getPublic(query: string) {
    return await api.books.getPublic(query)
  }

  async getInfo(id: number): Promise<Book | null> {
    try {
      const raw = await api.books.getInfo(id)
      const data = applyAcl(BookSchema, raw, `book.getInfo(${id})`)
      await offlineService.saveBookInfo(id, data).catch(() => {})
      return data
    }
    catch (error) {
      const offlineData = await offlineService.getBookInfo(id)
      if (offlineData)
        return applyAcl(BookSchema, offlineData, `book.getInfo(${id}) [offline]`)
      throw error
    }
  }

  async startReading(id: number) {
    return await api.books.startReading(id)
  }

  async updateInfo(id: number, data: Partial<Book>) {
    return await api.books.updateInfo(id, data)
  }

  async analyzeBook(id: number) {
    return await api.books.analyzeBook(id)
  }

  async analyzeVocabulary(id: number) {
    return await api.books.analyzeVocabulary(id)
  }

  async updateCover(id: number, file: File) {
    return await api.books.updateCover(id, file)
  }

  async updateStats(id: number, data: Partial<BookStats>) {
    return await api.books.updateStats(id, data)
  }

  async upload(file: File) {
    return await api.books.upload(file)
  }

  async createCustomManga(params: { title: string, author?: string | null, language: string, type: string }) {
    return await api.books.createCustomBook(params)
  }

  async appendMangaChapter(bookId: number, fd: FormData) {
    return await api.books.appendMangaChapter(bookId, fd)
  }

  async delete(id: number) {
    return await api.books.delete(id)
  }

  async saveLocalBookInfo(id: number, info: Book) {
    await offlineService.saveBookInfo(id, info)
  }

  async getToc(id: number): Promise<TocItem[]> {
    try {
      const raw = await api.books.getToc(id)
      const data = applyAcl(z.array(TocItemSchema), raw, `book.getToc(${id})`)
      await offlineService.saveToc(id, data).catch(() => {})
      return data
    }
    catch (error) {
      const offlineData = await offlineService.getToc(id)
      if (offlineData)
        return applyAcl(z.array(TocItemSchema), offlineData, `book.getToc(${id}) [offline]`)
      throw error
    }
  }

  async getPage(id: number, num: number, isSync?: boolean): Promise<PagePayload | null> {
    try {
      const cached = await offlineService.getPage(id, num)
      if (cached)
        return cached
    }
    catch (err) {
      console.warn('[Repository] Failed to retrieve from offline cache:', err)
    }

    const data = await api.books.getPage(id, num, isSync)
    if (data) {
      await offlineService.savePage(id, num, data).catch(() => {})
    }
    return data
  }

  async getPageDict(id: number, num: number): Promise<Record<string, PageDictEntry>> {
    try {
      const cached = await offlineService.getPageDictionary(id, num)
      if (cached)
        return cached
    }
    catch (err) {
      console.warn('[Repository] Failed to retrieve from offline cache:', err)
    }

    const res = await api.books.getPageDict(id, num)
    const data = res.pageDictionary || {}
    await offlineService.savePageDictionary(id, num, data).catch(() => {})
    return data
  }

  async saveLocalPageDictionary(id: number, num: number, data: Record<string, PageDictEntry>) {
    await offlineService.savePageDictionary(id, num, data)
  }

  async getLocalImage(bookId: number, pageNum: number) {
    return await offlineService.getImage(bookId, pageNum)
  }

  async saveLocalPage(id: number, num: number, data: PagePayload) {
    await offlineService.savePage(id, num, data)
  }

  async fetchImageBlob(url: string) {
    return await api.books.fetchImageBlob(url)
  }

  async saveLocalImage(bookId: number, pageNum: number, blob: Blob) {
    await offlineService.saveImage(bookId, pageNum, blob)
  }

  async getLocalCover(bookId: number) {
    return await offlineService.getCover(bookId)
  }

  async saveLocalCover(bookId: number, blob: Blob) {
    await offlineService.saveCover(bookId, blob)
  }

  async saveLocalToc(bookId: number, toc: TocItem[]) {
    await offlineService.saveToc(bookId, toc)
  }
}

export const bookRepository: IBookRepository = new DefaultBookRepository()
