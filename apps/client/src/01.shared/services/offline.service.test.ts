import type { UserDictItem } from '../types/models'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const idb = vi.hoisted(() => new Map<string, unknown>())
vi.mock('localforage', () => ({
  default: {
    config: vi.fn(),
    keys: async () => [...idb.keys()],
    getItem: async (key: string) => idb.get(key) ?? null,
    setItem: async (key: string, value: unknown) => idb.set(key, value),
    removeItem: async (key: string) => { idb.delete(key) },
  },
}))
vi.mock('~/01.shared/lib/router', () => ({ default: {} }))
vi.mock('~/01.shared/store/toast.store', () => ({ useToastStore: vi.fn() }))
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
  match: async (path: string) => media.get(absolute(path))?.clone(),
  put: async (path: string, response: Response) => { media.set(absolute(path), response.clone()) },
  keys: async () => [...media.keys()].map(url => new Request(url)),
  delete: async (path: string) => media.delete(absolute(path)),
}

beforeEach(() => {
  idb.clear()
  media.clear()
  localStorage.clear()
  localStorage.setItem('insight_token', 'test')
  localStorage.setItem('insight_uid', '1')
  vi.stubGlobal('caches', { open: async () => cache })
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
