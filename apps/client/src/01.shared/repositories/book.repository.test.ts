import type { Book, PageDictEntry, PagePayload, TocItem } from '~/01.shared/types/models'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DefaultBookRepository } from './book.repository'

const apiMocks = vi.hoisted(() => ({
  list: vi.fn(),
  getPublic: vi.fn(),
  getInfo: vi.fn(),
  startReading: vi.fn(),
  updateInfo: vi.fn(),
  analyzeBook: vi.fn(),
  analyzeVocabulary: vi.fn(),
  updateCover: vi.fn(),
  updateStats: vi.fn(),
  upload: vi.fn(),
  createCustomBook: vi.fn(),
  appendMangaChapter: vi.fn(),
  delete: vi.fn(),
  getToc: vi.fn(),
  getPage: vi.fn(),
  getPageDict: vi.fn(),
  fetchImageBlob: vi.fn(),
}))

const offlineMocks = vi.hoisted(() => ({
  saveBooksList: vi.fn(),
  getBooksList: vi.fn(),
  saveBookInfo: vi.fn(),
  getBookInfo: vi.fn(),
  saveToc: vi.fn(),
  getToc: vi.fn(),
  savePage: vi.fn(),
  getPage: vi.fn(),
  savePageDictionary: vi.fn(),
  getPageDictionary: vi.fn(),
  getImage: vi.fn(),
  saveImage: vi.fn(),
  getCover: vi.fn(),
  saveCover: vi.fn(),
}))

const authState = vi.hoisted(() => ({
  user: { id: 1 } as { id: number } | null,
  isSingleMode: false,
}))

vi.mock('~/01.shared/services/api.service', () => ({
  api: { books: apiMocks },
}))

vi.mock('~/01.shared/services/offline.service', () => ({
  offlineService: offlineMocks,
}))

vi.mock('~/01.shared/store/auth.store', () => ({
  useAuthStore: () => authState,
}))

const rawBook = {
  id: 10,
  title: null,
  currentPage: '3',
  createdAt: '2026-11-01T00:00:00Z',
}

const parsedBook: Book = {
  id: 10,
  title: 'Без названия',
  author: null,
  coverUrl: null,
  filePath: '',
  language: 'en',
  totalPages: 1,
  currentPage: 3,
  createdAt: '2026-11-01T00:00:00Z',
}

const tocItem: TocItem = {
  id: 'ch1',
  href: 'ch1.xhtml',
  title: 'Chapter 1',
  order: 0,
  level: 1,
}

const pagePayload: PagePayload = {
  page: 1,
  totalPages: 10,
  content: 'Hello world.',
}

const pageDict: Record<string, PageDictEntry> = {
  hello: { transcription: 'həˈloʊ', translation: 'привет' },
}

function setOnline(online: boolean) {
  Object.defineProperty(navigator, 'onLine', {
    configurable: true,
    value: online,
  })
}

describe('book repository', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authState.user = { id: 1 }
    authState.isSingleMode = false
    setOnline(true)
    offlineMocks.saveBooksList.mockResolvedValue(undefined)
    offlineMocks.saveBookInfo.mockResolvedValue(undefined)
    offlineMocks.saveToc.mockResolvedValue(undefined)
    offlineMocks.savePage.mockResolvedValue(undefined)
    offlineMocks.savePageDictionary.mockResolvedValue(undefined)
  })

  afterEach(() => {
    setOnline(true)
  })

  it('returns empty list when unauthenticated and not in single mode', async () => {
    authState.user = null
    authState.isSingleMode = false

    const repo = new DefaultBookRepository()
    await expect(repo.list()).resolves.toEqual([])
    expect(apiMocks.list).not.toHaveBeenCalled()
  })

  it('lists books in single mode or authenticated mode, validates via ACL, and handles offline fallback', async () => {
    authState.user = null
    authState.isSingleMode = true
    apiMocks.list.mockResolvedValueOnce([rawBook])
    offlineMocks.saveBooksList.mockRejectedValueOnce(new Error('quota'))

    const repo = new DefaultBookRepository()
    await expect(repo.list()).resolves.toEqual([parsedBook])
    expect(offlineMocks.saveBooksList).toHaveBeenCalledWith([parsedBook])

    const networkError = new TypeError('Failed to fetch')
    apiMocks.list.mockRejectedValueOnce(networkError)
    offlineMocks.getBooksList.mockResolvedValueOnce([rawBook])
    await expect(repo.list()).resolves.toEqual([parsedBook])

    const authError = Object.assign(new Error('Unauthorized'), { status: 401 })
    apiMocks.list.mockRejectedValueOnce(authError)
    await expect(repo.list()).rejects.toBe(authError)

    apiMocks.list.mockRejectedValueOnce(networkError)
    offlineMocks.getBooksList.mockResolvedValueOnce([])
    await expect(repo.list()).rejects.toBe(networkError)
  })

  it('loads book info with ACL validation and offline fallback', async () => {
    apiMocks.getInfo.mockResolvedValueOnce(rawBook)
    offlineMocks.saveBookInfo.mockRejectedValueOnce(new Error('write fail'))

    const repo = new DefaultBookRepository()
    await expect(repo.getInfo(10)).resolves.toEqual(parsedBook)
    expect(offlineMocks.saveBookInfo).toHaveBeenCalledWith(10, parsedBook)

    const networkError = new TypeError('Failed to fetch')
    apiMocks.getInfo.mockRejectedValueOnce(networkError)
    offlineMocks.getBookInfo.mockResolvedValueOnce(rawBook)
    await expect(repo.getInfo(10)).resolves.toEqual(parsedBook)

    const forbidden = Object.assign(new Error('Forbidden'), { status: 403 })
    apiMocks.getInfo.mockRejectedValueOnce(forbidden)
    await expect(repo.getInfo(10)).rejects.toBe(forbidden)

    apiMocks.getInfo.mockRejectedValueOnce(networkError)
    offlineMocks.getBookInfo.mockResolvedValueOnce(null)
    await expect(repo.getInfo(10)).rejects.toBe(networkError)
  })

  it('loads table of contents with ACL validation and offline fallback', async () => {
    apiMocks.getToc.mockResolvedValueOnce([{ id: 'ch1', href: 'ch1.xhtml', title: 'Chapter 1' }])
    offlineMocks.saveToc.mockRejectedValueOnce(new Error('write fail'))

    const repo = new DefaultBookRepository()
    await expect(repo.getToc(10)).resolves.toEqual([tocItem])
    expect(offlineMocks.saveToc).toHaveBeenCalledWith(10, [tocItem])

    const networkError = new TypeError('Failed to fetch')
    apiMocks.getToc.mockRejectedValueOnce(networkError)
    offlineMocks.getToc.mockResolvedValueOnce([tocItem])
    await expect(repo.getToc(10)).resolves.toEqual([tocItem])

    const notFound = Object.assign(new Error('Not found'), { status: 404 })
    apiMocks.getToc.mockRejectedValueOnce(notFound)
    await expect(repo.getToc(10)).rejects.toBe(notFound)

    apiMocks.getToc.mockRejectedValueOnce(networkError)
    offlineMocks.getToc.mockResolvedValueOnce(null)
    await expect(repo.getToc(10)).rejects.toBe(networkError)
  })

  it('loads page online, falls back to offline cache on network failure, and avoids network when offline', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const repo = new DefaultBookRepository()

    apiMocks.getPage.mockResolvedValueOnce(pagePayload)
    offlineMocks.savePage.mockRejectedValueOnce(new Error('quota'))
    await expect(repo.getPage(10, 1)).resolves.toEqual(pagePayload)
    expect(offlineMocks.savePage).toHaveBeenCalledWith(10, 1, pagePayload)

    const networkError = new TypeError('Failed to fetch')
    apiMocks.getPage.mockRejectedValueOnce(networkError)
    offlineMocks.getPage.mockResolvedValueOnce(pagePayload)
    await expect(repo.getPage(10, 1)).resolves.toEqual(pagePayload)

    const authError = Object.assign(new Error('Unauthorized'), { status: 401 })
    apiMocks.getPage.mockRejectedValueOnce(authError)
    await expect(repo.getPage(10, 1)).rejects.toBe(authError)

    apiMocks.getPage.mockRejectedValueOnce(networkError)
    offlineMocks.getPage.mockRejectedValueOnce(new Error('idb failure'))
    await expect(repo.getPage(10, 1)).rejects.toBe(networkError)
    expect(warnSpy).toHaveBeenCalled()

    // Offline read uses cache first and returns null on miss without waiting for network
    setOnline(false)
    apiMocks.getPage.mockClear()
    offlineMocks.getPage.mockResolvedValueOnce(pagePayload)
    await expect(repo.getPage(10, 2)).resolves.toEqual(pagePayload)
    expect(apiMocks.getPage).not.toHaveBeenCalled()

    offlineMocks.getPage.mockResolvedValueOnce(null)
    await expect(repo.getPage(10, 3)).resolves.toBeNull()
    expect(apiMocks.getPage).not.toHaveBeenCalled()

    // Explicit sync still hits network even when navigator.onLine is false
    apiMocks.getPage.mockResolvedValueOnce(pagePayload)
    await expect(repo.getPage(10, 4, true)).resolves.toEqual(pagePayload)
    expect(apiMocks.getPage).toHaveBeenCalledWith(
      10,
      4,
      true,
      undefined,
    )
    warnSpy.mockRestore()
  })

  it('loads page dictionary online, falls back offline, and returns empty dict when offline and uncached', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const controller = new AbortController()
    const repo = new DefaultBookRepository()

    apiMocks.getPageDict.mockResolvedValueOnce({ pageDictionary: pageDict })
    offlineMocks.savePageDictionary.mockRejectedValueOnce(new Error('quota'))
    await expect(repo.getPageDict(10, 1, controller.signal)).resolves.toEqual(pageDict)
    expect(offlineMocks.savePageDictionary).toHaveBeenCalledWith(10, 1, pageDict)

    apiMocks.getPageDict.mockResolvedValueOnce({ pageDictionary: undefined })
    await expect(repo.getPageDict(10, 1)).resolves.toEqual({})

    const networkError = new TypeError('Failed to fetch')
    apiMocks.getPageDict.mockRejectedValueOnce(networkError)
    offlineMocks.getPageDictionary.mockResolvedValueOnce(pageDict)
    await expect(repo.getPageDict(10, 1)).resolves.toEqual(pageDict)

    const authError = Object.assign(new Error('Unauthorized'), { status: 401 })
    apiMocks.getPageDict.mockRejectedValueOnce(authError)
    await expect(repo.getPageDict(10, 1)).rejects.toBe(authError)

    apiMocks.getPageDict.mockRejectedValueOnce(networkError)
    offlineMocks.getPageDictionary.mockRejectedValueOnce(new Error('idb fail'))
    await expect(repo.getPageDict(10, 1)).rejects.toBe(networkError)
    expect(warnSpy).toHaveBeenCalled()

    setOnline(false)
    apiMocks.getPageDict.mockClear()
    offlineMocks.getPageDictionary.mockResolvedValueOnce(pageDict)
    await expect(repo.getPageDict(10, 2)).resolves.toEqual(pageDict)
    expect(apiMocks.getPageDict).not.toHaveBeenCalled()

    offlineMocks.getPageDictionary.mockResolvedValueOnce(null)
    await expect(repo.getPageDict(10, 3)).resolves.toEqual({})
    expect(apiMocks.getPageDict).not.toHaveBeenCalled()
    warnSpy.mockRestore()
  })

  it('delegates CRUD, upload, manga, and local cache helper methods', async () => {
    const repo = new DefaultBookRepository()
    const file = new File(['content'], 'book.epub')
    const blob = new Blob(['img'], { type: 'image/png' })
    const fd = new FormData()

    apiMocks.getPublic.mockResolvedValue({ data: [parsedBook], total: 1, page: 1, limit: 20 })
    apiMocks.startReading.mockResolvedValue({ success: true })
    apiMocks.updateInfo.mockResolvedValue({ success: true })
    apiMocks.analyzeBook.mockResolvedValue({ success: true, stats: undefined })
    apiMocks.analyzeVocabulary.mockResolvedValue({ success: true, lexicalStats: { totalWords: 10, totalSentences: 2 } })
    apiMocks.updateCover.mockResolvedValue({ success: true, coverUrl: '/cover.jpg' })
    apiMocks.updateStats.mockResolvedValue({ success: true, stats: {} })
    apiMocks.upload.mockResolvedValue({ success: true, book: parsedBook })
    apiMocks.createCustomBook.mockResolvedValue({ success: true, book: parsedBook })
    apiMocks.appendMangaChapter.mockResolvedValue({ success: true, book: parsedBook })
    apiMocks.delete.mockResolvedValue({ success: true })
    apiMocks.fetchImageBlob.mockResolvedValue(blob)
    offlineMocks.getImage.mockResolvedValue(blob)
    offlineMocks.getCover.mockResolvedValue(blob)

    await expect(repo.getPublic('page=1')).resolves.toEqual({ data: [parsedBook], total: 1, page: 1, limit: 20 })
    await expect(repo.startReading(10)).resolves.toEqual({ success: true })
    await expect(repo.updateInfo(10, { title: 'New' })).resolves.toEqual({ success: true })
    await expect(repo.analyzeBook(10)).resolves.toEqual({ success: true, stats: undefined })
    await expect(repo.analyzeVocabulary(10)).resolves.toEqual({ success: true, lexicalStats: { totalWords: 10, totalSentences: 2 } })
    await expect(repo.updateCover(10, file)).resolves.toEqual({ success: true, coverUrl: '/cover.jpg' })
    await expect(repo.updateStats(10, { totalWords: 100 })).resolves.toEqual({ success: true, stats: {} })
    await expect(repo.upload(file)).resolves.toEqual({ success: true, book: parsedBook })
    await expect(repo.createCustomManga({ title: 'Manga', language: 'ja', type: 'manga' })).resolves.toEqual({ success: true, book: parsedBook })
    await expect(repo.appendMangaChapter(10, fd)).resolves.toEqual({ success: true, book: parsedBook })
    await expect(repo.delete(10)).resolves.toEqual({ success: true })
    await expect(repo.fetchImageBlob('/uploads/1.png')).resolves.toBe(blob)

    await repo.saveLocalBookInfo(10, parsedBook)
    await repo.saveLocalPageDictionary(10, 1, pageDict)
    await expect(repo.getLocalImage(10, 1)).resolves.toBe(blob)
    await repo.saveLocalPage(10, 1, pagePayload)
    await repo.saveLocalImage(10, 1, blob)
    await expect(repo.getLocalCover(10)).resolves.toBe(blob)
    await repo.saveLocalCover(10, blob)
    await repo.saveLocalToc(10, [tocItem])

    expect(apiMocks.createCustomBook).toHaveBeenCalledWith({ title: 'Manga', language: 'ja', type: 'manga' })
    expect(apiMocks.appendMangaChapter).toHaveBeenCalledWith(10, fd)
    expect(offlineMocks.saveBookInfo).toHaveBeenCalledWith(10, parsedBook)
    expect(offlineMocks.savePageDictionary).toHaveBeenCalledWith(10, 1, pageDict)
    expect(offlineMocks.savePage).toHaveBeenCalledWith(10, 1, pagePayload)
    expect(offlineMocks.saveImage).toHaveBeenCalledWith(10, 1, blob)
    expect(offlineMocks.saveCover).toHaveBeenCalledWith(10, blob)
    expect(offlineMocks.saveToc).toHaveBeenCalledWith(10, [tocItem])
  })
})
