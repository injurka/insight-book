import type { Book, DictDeck, Highlight, LlmAnalysis, PagePayload, TocItem, UserDictItem } from './models'

export interface DictionaryQueryParams {
  query?: string
  deckId?: number
  language?: string
  targetLanguage?: string
  state?: number
  limit?: number
  offset?: number
  sortBy?: 'word' | 'createdAt' | 'due' | 'difficulty'
  sortOrder?: 'asc' | 'desc'
}

export interface ClientToWorkerRPC {
  initDb: () => Promise<void>

  // Key-Value Settings Storage
  saveSetting: (key: string, value: string) => Promise<void>
  getSetting: (key: string) => Promise<string | null>
  deleteSetting: (key: string) => Promise<void>

  // Dictionary
  saveDictionary: (words: UserDictItem[], lang?: string) => Promise<void>
  getDictionary: (params?: DictionaryQueryParams) => Promise<{ items: UserDictItem[], total: number }>
  getAllDictionaryWords: (lang?: string) => Promise<UserDictItem[]>
  saveDecks: (decks: DictDeck[], lang?: string) => Promise<void>
  getDecks: (lang?: string) => Promise<DictDeck[]>
  getReviewQueue: (limit?: number) => Promise<UserDictItem[]>
  updateWordFsrs: (id: number, fsrsData: Partial<UserDictItem>) => Promise<void>

  // Books & Pages
  saveBookInfo: (info: Book) => Promise<void>
  getBookInfo: (id: number) => Promise<Book | null>
  saveBooksList: (books: Book[]) => Promise<void>
  getBooksList: () => Promise<Book[]>
  savePage: (bookId: number, pageNum: number, payload: PagePayload) => Promise<void>
  getPage: (bookId: number, pageNum: number) => Promise<PagePayload | null>
  savePagesBatch: (pages: { bookId: number, pageNum: number, payload: PagePayload }[]) => Promise<void>
  saveToc: (bookId: number, toc: TocItem[]) => Promise<void>
  getToc: (bookId: number) => Promise<TocItem[] | null>
  saveHighlights: (bookId: number, highlights: Highlight[]) => Promise<void>
  getHighlights: (bookId: number) => Promise<Highlight[] | null>

  // Analysis
  saveAnalysis: (text: string, analysis: LlmAnalysis, lang?: string) => Promise<void>
  getAnalysis: (text: string, lang?: string) => Promise<LlmAnalysis | null>

  // Media (OPFS)
  saveMedia: (path: string, buffer: ArrayBuffer, mimeType: string) => Promise<void>
  getMedia: (path: string) => Promise<{ buffer: ArrayBuffer, mimeType: string } | null>
  deleteMedia: (path: string) => Promise<void>

  // Remote Dictionary attach & sync
  downloadAndAttachPublicDict: (dbUrl: string, mediaZipUrl?: string, token?: string) => Promise<void>

  // Stats & Clean up
  getStorageStats: () => Promise<{
    bookStats: Record<number, {
      title: string
      totalPages: number
      cachedPages: number[]
      analysesCount: number
      sizeBytes: number
      imagesCount: number
      ttsCount: number
      dictPagesCount: number
    }>
    totalDictionaryWords: number
    totalSizeBytes: number
    languageStats: Record<string, {
      analysesCount: number
      dictionaryWords: number
      sizeBytes: number
    }>
  }>
  deleteLanguage: (lang: string) => Promise<void>
  clearBookCache: (bookId: number) => Promise<void>
  clearAllData: () => Promise<void>
}

export interface WorkerToClientRPC {
  onSyncProgress: (progress: { stage: string, loaded: number, total: number }) => void
  onMigrationProgress: (progress: { current: number, total: number, message: string }) => void
}
