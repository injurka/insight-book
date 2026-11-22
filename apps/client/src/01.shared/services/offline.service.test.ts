import type { UserDictItem } from '../types/models'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const idb = vi.hoisted(() => new Map<string, unknown>())
const idbHooks = vi.hoisted(() => ({
  setItemOverride: null as ((key: string, value: unknown) => Promise<unknown>) | null,
  getItemOverride: null as ((key: string) => Promise<unknown>) | null,
}))
const toastErrorMock = vi.hoisted(() => vi.fn())
const routerPushMock = vi.hoisted(() => vi.fn())

vi.mock('localforage', () => ({
  default: {
    config: vi.fn(),
    keys: async () => [...idb.keys()],
    getItem: async (key: string) => {
      if (idbHooks.getItemOverride)
        return idbHooks.getItemOverride(key)

      return idb.get(key) ?? null
    },
    setItem: async (key: string, value: unknown) => {
      if (idbHooks.setItemOverride)
        return idbHooks.setItemOverride(key, value)

      return idb.set(key, value)
    },
    removeItem: async (key: string) => { idb.delete(key) },
  },
}))
vi.mock('~/01.shared/lib/router', () => ({ default: { push: routerPushMock } }))
vi.mock('~/01.shared/store/toast.store', () => ({ useToastStore: () => ({ error: toastErrorMock }) }))
vi.mock('../store/settings.store', () => ({ useGlobalSettingsStore: vi.fn() }))

const { offlineService } = await import('./offline.service')
const metadata = {
  id: 'audio-id',
  model: 'tts-1',
  provider: 'aihubmix.com',
  voice: 'alloy',
  requestedVoice: 'Kore',
  createdAt: '2026-10-05T00:00:00Z',
}
const media = new Map<string, Response>()
const absolute = (path: string) => new URL(path, 'https://example.test').href
const cache = {
  match: async (path: string | Request) => media.get(absolute(typeof path === 'string' ? path : path.url))?.clone(),
  put: async (path: string | Request, response: Response) => { media.set(absolute(typeof path === 'string' ? path : path.url), response.clone()) },
  keys: async () => [...media.keys()].map(url => new Request(url)),
  delete: async (path: string | Request) => media.delete(absolute(typeof path === 'string' ? path : path.url)),
}

beforeEach(() => {
  idb.clear()
  media.clear()
  idbHooks.setItemOverride = null
  idbHooks.getItemOverride = null
  toastErrorMock.mockClear()
  routerPushMock.mockClear()
  localStorage.clear()
  localStorage.setItem('insight_token', 'test')
  localStorage.setItem('insight_uid', '1')
  vi.stubGlobal('caches', { open: async () => cache, delete: vi.fn().mockResolvedValue(true) })
})

describe('tTS offline persistence', () => {
  it('reuses legacy audio for default and reports unknown provenance', async () => {
    media.set(absolute('/offline/u1/tts/mp3_v1_1_longanhuan_v3.6_hello.'), new Response('old audio'))
    const blob = await offlineService.getTtsBlob('mp3_v1_1_default_hello.')
    expect(await blob?.text()).toBe('old audio')
    expect((await offlineService.getTtsMetadata('mp3_v1_1_default_hello.'))?.model).toBe('unknown')
  })

  it('preserves actual fallback provenance in Cache API', async () => {
    await offlineService.saveTts('mp3_v1_1_Kore_hello.', 'QUJD', metadata)
    expect(await (await offlineService.getTtsBlob('mp3_v1_1_default_hello.'))?.text()).toBe('ABC')
    expect(await offlineService.getTtsMetadata('mp3_v1_1_default_hello.')).toEqual(metadata)
  })

  it('keeps another user’s cached audio isolated', async () => {
    await offlineService.saveTts('mp3_v1_1_Kore_hello.', 'QUJD', metadata)
    localStorage.setItem('insight_uid', '2')
    expect(await offlineService.getTtsBlob('mp3_v1_1_default_hello.')).toBeNull()
  })

  it('reads legacy IndexedDB strings and writes provenance when Cache API is unavailable', async () => {
    vi.stubGlobal('caches', { open: async () => null })
    idb.set('u1_tts_mp3_v1_1_longanhuan_v3.6_hello.', 'QUJD')
    expect(await (await offlineService.getTtsBlob('mp3_v1_1_default_hello.'))?.text()).toBe('ABC')
    expect((await offlineService.getTtsMetadata('mp3_v1_1_default_hello.'))?.model).toBe('unknown')
    await offlineService.saveTts('mp3_v1_1_Kore_new.', 'QUJD', metadata)
    expect(await offlineService.getTtsMetadata('mp3_v1_1_default_new.')).toEqual(metadata)
  })
})

describe('dictionary offline invalidation', () => {
  it('clears dictionary snapshots while preserving decks and other users', async () => {
    const staleKeys = [
      'u1_dictionary_page_ru_{}',
      'u1_dictionary_word_ru_test',
      'u1_dictionary_words',
      'u1_dictionary_words_ru',
    ]

    for (const key of staleKeys)
      idb.set(key, { stale: true })

    idb.set('u1_dictionary_decks', ['deck'])
    idb.set('u1_book_1_page_1', { text: 'book' })
    idb.set('u2_dictionary_page_ru_{}', { otherUser: true })
    await offlineService.invalidateDictionaryCache()
    expect(staleKeys.every(key => !idb.has(key))).toBe(true)
    expect([...idb.keys()].sort()).toEqual([
      'u1_book_1_page_1',
      'u1_dictionary_decks',
      'u2_dictionary_page_ru_{}',
    ])
  })
})

describe('dictionary offline word identity', () => {
  it('keeps identical spellings separate by source and target language and user', async () => {
    const english = { word: 'gift', language: 'en', targetLanguage: 'ru', translation: 'подарок' } as UserDictItem
    const german = { word: 'gift', language: 'de', targetLanguage: 'ru', translation: 'яд' } as UserDictItem
    await offlineService.saveDictionaryWord(english)
    await offlineService.saveDictionaryWord(german)
    expect(await offlineService.getDictionaryWord('gift', 'en')).toEqual(english)
    expect(await offlineService.getDictionaryWord('gift', 'de')).toEqual(german)
    localStorage.setItem('global-app-language', JSON.stringify('zh'))
    expect(await offlineService.getDictionaryWord('gift', 'en')).toBeNull()
    localStorage.removeItem('global-app-language')
    localStorage.setItem('insight_uid', '2')
    expect(await offlineService.getDictionaryWord('gift', 'en')).toBeNull()
  })

  it('only reuses legacy word caches for their recorded source language', async () => {
    const german = { word: 'gift', language: 'de', translation: 'яд' } as UserDictItem
    idb.set('u1_dictionary_word_ru_gift', german)
    expect(await offlineService.getDictionaryWord('gift', 'de')).toEqual(german)
    expect(await offlineService.getDictionaryWord('gift', 'en')).toBeNull()
  })
})

describe('dictionary links without source language offline', () => {
  it('opens a unique word cached individually, including both cache formats', async () => {
    const card = { id: 1, word: 'gift', language: 'en', targetLanguage: 'ru' } as UserDictItem
    idb.set('u1_dictionary_word_ru_gift', card)
    await offlineService.saveDictionaryWord(card)
    expect(await offlineService.getDictionaryWord('gift')).toEqual(card)
  })

  it('does not guess a language when individual caches contradict an older full snapshot', async () => {
    const english = { id: 1, word: 'gift', language: 'en', targetLanguage: 'ru' } as UserDictItem
    const german = { id: 2, word: 'gift', language: 'de', targetLanguage: 'ru' } as UserDictItem
    await offlineService.saveDictionary([english])
    await offlineService.saveDictionaryWord(english)
    await offlineService.saveDictionaryWord(german)
    expect(await offlineService.getDictionaryWord('gift')).toBeNull()
    expect(await offlineService.getDictionaryWord('gift', 'en')).toEqual(english)
    expect(await offlineService.getDictionaryWord('gift', 'de')).toEqual(german)
  })

  it('uses the full snapshot when needed and excludes other target languages', async () => {
    const card = { id: 1, word: 'gift', language: 'en', targetLanguage: 'ru' } as UserDictItem
    await offlineService.saveDictionary([card])
    expect(await offlineService.getDictionaryWord('gift')).toEqual(card)
    localStorage.setItem('global-app-language', JSON.stringify('zh'))
    expect(await offlineService.getDictionaryWord('gift')).toBeNull()
  })
})

describe('books, media, analysis, and cache management', () => {
  it('stores and retrieves book pages, metadata, toc, highlights, decks, dictionary pages, and page dicts', async () => {
    const book = { id: 7, title: 'Dune', totalPages: 20, createdAt: '2026-01-01' } as Book
    const page = { page: 1, totalPages: 20, content: 'Arrakis' } as PagePayload
    const toc = [{
      id: '1',
      href: 'c1',
      title: 'Ch 1',
      order: 0,
      level: 1,
    }] as TocItem[]
    const highlights = [{
      id: 1,
      userId: 1,
      bookId: 7,
      text: 'Spice',
      color: 'yellow',
      pageNum: 1,
      createdAt: '2026-01-01',
    }] as Highlight[]
    const decks = [{
      id: 1,
      userId: 1,
      name: 'Main',
      language: 'en',
      targetLanguage: 'ru',
      createdAt: '2026-01-01',
    }] as DictDeck[]

    await offlineService.saveBooksList([book])
    await offlineService.saveBookInfo(7, book)
    await offlineService.saveToc(7, toc)
    await offlineService.saveHighlights(7, highlights)
    await offlineService.savePage(7, 1, page)
    await offlineService.savePageDictionary(7, 1, { spice: { transcription: 'spaɪs', translation: 'пряность' } })
    await offlineService.saveDecks(decks)
    await offlineService.saveDictionaryPage({ limit: 10 }, {
      items: [],
      total: 0,
      totalWords: 0,
      nextOffset: null,
      languages: [],
      deckCounts: [],
    })

    expect(await offlineService.getBooksList()).toEqual([book])
    expect(await offlineService.getBookInfo(7)).toEqual(book)
    expect(await offlineService.getToc(7)).toEqual(toc)
    expect(await offlineService.getHighlights(7)).toEqual(highlights)
    expect(await offlineService.getPage(7, 1)).toEqual(page)
    expect(await offlineService.getPageDictionary(7, 1)).toEqual({ spice: { transcription: 'spaɪs', translation: 'пряность' } })
    expect(await offlineService.getDecks()).toEqual(decks)
    expect(await offlineService.getDictionaryPage({ limit: 10 })).toMatchObject({ total: 0 })

    // Legacy locale-keyed decks fallback
    idb.delete('u1_dictionary_decks')
    idb.set('u1_dictionary_decks_ru', decks)
    expect(await offlineService.getDecks()).toEqual(decks)
  })

  it('stores images and covers in Cache API and falls back to IndexedDB when Cache API is unavailable', async () => {
    const imgBlob = new Blob(['png-data'], { type: 'image/png' })
    const coverBlob = new Blob(['jpg-data'], { type: 'image/jpeg' })

    await offlineService.saveImage(7, 1, imgBlob)
    await offlineService.saveCover(7, coverBlob)
    expect(await (await offlineService.getImage(7, 1))?.text()).toBe('png-data')
    expect(await (await offlineService.getCover(7))?.text()).toBe('jpg-data')

    // Fallback when Cache API is unavailable
    vi.stubGlobal('caches', { open: async () => null })
    await offlineService.saveImage(7, 2, imgBlob)
    await offlineService.saveCover(8, coverBlob)
    expect(await offlineService.getImage(7, 2)).toBe(imgBlob)
    expect(await offlineService.getCover(8)).toBe(coverBlob)
  })

  it('uses L1 RAM cache and L2 IndexedDB for LLM analysis and supports single-user scope', async () => {
    localStorage.clear()
    localStorage.setItem('insight_auth_mode', 'single')
    const analysis: LlmAnalysis = {
      transcription: 'həˈloʊ',
      translation: 'привет',
      grammarRules: [],
      vocabulary: [],
    }

    await offlineService.saveAnalysis('Hello', analysis, 'en')
    expect(await offlineService.getAnalysis('Hello', 'en')).toEqual(analysis)

    // L2 lookup for an entry not yet in L1
    idb.set('u1_analysis_en_ru_world', analysis)
    expect(await offlineService.getAnalysis('World', 'en')).toEqual(analysis)
    expect(await offlineService.getAnalysis('', 'en')).toBeNull()
  })

  it('collects cache stats across IndexedDB and Media Cache and clears a specific book cache', async () => {
    const book = { id: 7, title: 'Dune', totalPages: 20, createdAt: '2026-01-01' } as Book
    const otherBook = { id: 8, title: 'Foundation', totalPages: 15, createdAt: '2026-01-01' } as Book

    await offlineService.saveBooksList([book, otherBook])
    await offlineService.saveBookInfo(7, book)
    await offlineService.saveToc(7, [])
    await offlineService.saveHighlights(7, [])
    await offlineService.savePage(7, 1, { page: 1, totalPages: 20, content: 'Page 1' })
    await offlineService.savePage(8, 1, { page: 1, totalPages: 15, content: 'Other' })
    await offlineService.saveImage(7, 1, new Blob(['12345'], { type: 'image/png' }))
    await offlineService.saveCover(7, new Blob(['123'], { type: 'image/jpeg' }))
    await offlineService.saveTts('7_sample', 'QUJD', metadata)
    idb.set('u1_dictionary_words_ru', [{ word: 'a' }, { word: 'b' }])

    const stats = await offlineService.getCacheStats()
    expect(stats.totalDictionaryWords).toBe(2)
    expect(stats.bookStats[7].cachedPages).toEqual([1])
    expect(stats.bookStats[7].imagesCount).toBe(1)
    expect(stats.bookStats[7].ttsCount).toBe(1)
    expect(stats.totalSizeBytes).toBeGreaterThan(0)

    await offlineService.clearBookCache(7)
    expect(await offlineService.getPage(7, 1)).toBeNull()
    expect(await offlineService.getImage(7, 1)).toBeNull()
    expect(await offlineService.getCover(7)).toBeNull()
    expect(await offlineService.getPage(8, 1)).toEqual({ page: 1, totalPages: 15, content: 'Other' })
  })

  it('reports storage estimate, requests persistent storage, and handles quota/corrupted item errors', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    Object.defineProperty(navigator, 'storage', {
      configurable: true,
      value: {
        estimate: vi.fn().mockResolvedValue({ usage: 500, quota: 5000 }),
        persist: vi.fn().mockResolvedValue(true),
      },
    })

    expect(await offlineService.getStorageEstimate()).toEqual({ usage: 500, quota: 5000 })
    expect(await offlineService.requestPersistentStorage()).toBe(true)

    // QuotaExceededError surfaces a toast with clear-cache action
    idbHooks.setItemOverride = async () => {
      const err = new Error('quota')
      err.name = 'QuotaExceededError'
      throw err
    }
    await offlineService.saveBookInfo(1, { id: 1, title: 'T', createdAt: '2026-01-01' } as Book)
    expect(toastErrorMock).toHaveBeenCalledOnce()
    const toastOpts = toastErrorMock.mock.calls[0][1] as { action?: { onClick?: () => void } }
    toastOpts.action?.onClick?.()
    expect(routerPushMock).toHaveBeenCalledOnce()

    // Corrupted IndexedDB read removes item and returns null
    idbHooks.getItemOverride = async () => {
      throw new Error('corrupted')
    }
    expect(await offlineService.getBookInfo(1)).toBeNull()
    expect(errorSpy).toHaveBeenCalled()
    errorSpy.mockRestore()
  })
})
