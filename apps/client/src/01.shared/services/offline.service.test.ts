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
