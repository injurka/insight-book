import type { Book, DictDeck, Highlight, LlmAnalysis, PageDictEntry, PagePayload, TocItem, UserDictItem } from '../types/models'
import { dbRpc } from '~/01.shared/lib/db.client'

export const offlineService = {
  async savePage(bookId: number, pageNum: number, payload: PagePayload) {
    await dbRpc.savePage(bookId, pageNum, JSON.parse(JSON.stringify(payload)))
  },

  async getPage(bookId: number, pageNum: number): Promise<PagePayload | null> {
    return dbRpc.getPage(bookId, pageNum)
  },

  async saveImage(bookId: number, pageNum: number, blob: Blob) {
    const buffer = await blob.arrayBuffer()
    await dbRpc.saveMedia(`opfs-media/manga/${bookId}/${pageNum}.jpg`, buffer, blob.type)
  },

  async getImage(bookId: number, pageNum: number): Promise<Blob | null> {
    const media = await dbRpc.getMedia(`opfs-media/manga/${bookId}/${pageNum}.jpg`)
    if (media)
      return new Blob([media.buffer], { type: media.mimeType })

    return null
  },

  async saveCover(bookId: number, blob: Blob) {
    const buffer = await blob.arrayBuffer()
    await dbRpc.saveMedia(`opfs-media/covers/${bookId}.jpg`, buffer, blob.type)
  },

  async getCover(bookId: number): Promise<Blob | null> {
    const media = await dbRpc.getMedia(`opfs-media/covers/${bookId}.jpg`)
    if (media)
      return new Blob([media.buffer], { type: media.mimeType })

    return null
  },

  async savePageDictionary(bookId: number, pageNum: number, dict: Record<string, PageDictEntry>) {
    const existing = await dbRpc.getPage(bookId, pageNum)
    if (existing) {
      existing.pageDictionary = dict
      await dbRpc.savePage(bookId, pageNum, JSON.parse(JSON.stringify(existing)))
    }
    else {
      await dbRpc.savePage(bookId, pageNum, {
        bookId,
        pageNum,
        totalPages: 0,
        content: '',
        pageDictionary: dict,
      })
    }
  },

  async getPageDictionary(bookId: number, pageNum: number): Promise<Record<string, PageDictEntry> | null> {
    const page = await dbRpc.getPage(bookId, pageNum)

    return page?.pageDictionary || null
  },

  async saveBookInfo(_bookId: number, info: Book) {
    await dbRpc.saveBookInfo(JSON.parse(JSON.stringify(info)))
  },

  async getBookInfo(bookId: number): Promise<Book | null> {
    return dbRpc.getBookInfo(bookId)
  },

  async saveBooksList(books: Book[]) {
    await dbRpc.saveBooksList(JSON.parse(JSON.stringify(books)))
  },

  async getBooksList(): Promise<Book[] | null> {
    return dbRpc.getBooksList()
  },

  async saveToc(bookId: number, toc: TocItem[]) {
    await dbRpc.saveToc(bookId, JSON.parse(JSON.stringify(toc)))
  },

  async getToc(bookId: number): Promise<TocItem[] | null> {
    return dbRpc.getToc(bookId)
  },

  async saveHighlights(bookId: number, highlights: Highlight[]) {
    await dbRpc.saveHighlights(bookId, JSON.parse(JSON.stringify(highlights)))
  },

  async getHighlights(bookId: number): Promise<Highlight[] | null> {
    return dbRpc.getHighlights(bookId)
  },

  async saveDictionary(words: UserDictItem[]) {
    await dbRpc.saveDictionary(JSON.parse(JSON.stringify(words)))
  },

  async getDictionary(): Promise<UserDictItem[] | null> {
    return dbRpc.getAllDictionaryWords()
  },

  async saveDecks(decks: DictDeck[]) {
    await dbRpc.saveDecks(JSON.parse(JSON.stringify(decks)))
  },

  async getDecks(): Promise<DictDeck[] | null> {
    return dbRpc.getDecks()
  },

  async saveAnalysis(text: string, analysis: LlmAnalysis, lang?: string) {
    await dbRpc.saveAnalysis(text, JSON.parse(JSON.stringify(analysis)), lang)
  },

  async getAnalysis(text: string, lang?: string): Promise<LlmAnalysis | null> {
    return dbRpc.getAnalysis(text, lang)
  },

  async saveTts(hashKey: string, audioBase64: string) {
    const mimeType = audioBase64.startsWith('UklGR') ? 'audio/wav' : 'audio/mp3'
    const binaryString = window.atob(audioBase64)
    const bytes = new Uint8Array(binaryString.length)
    for (let i = 0; i < binaryString.length; i++)
      bytes[i] = binaryString.charCodeAt(i)

    const ext = mimeType === 'audio/wav' ? 'wav' : 'mp3'
    await dbRpc.saveMedia(`opfs-media/tts/${hashKey}.${ext}`, bytes.buffer, mimeType)
  },

  async getTtsBlob(hashKey: string): Promise<Blob | null> {
    let media = await dbRpc.getMedia(`opfs-media/tts/${hashKey}.mp3`)
    if (!media)
      media = await dbRpc.getMedia(`opfs-media/tts/${hashKey}.wav`)

    if (media)
      return new Blob([media.buffer], { type: media.mimeType })

    return null
  },

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
    return dbRpc.getStorageStats()
  },

  async clearBookCache(bookId: number) {
    await dbRpc.clearBookCache(bookId)
  },

  async deleteLanguage(lang: string) {
    await dbRpc.deleteLanguage(lang)
  },
}
