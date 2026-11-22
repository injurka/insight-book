import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DictDeckSchema, UserDictItemSchema } from '../types/schemas/dictionary.schema'
import { DefaultDictionaryRepository } from './dictionary.repository'

const apiMocks = vi.hoisted(() => ({
  openBookDeck: vi.fn(),
  generateBookDeckWord: vi.fn(),
  saveBookDeck: vi.fn(),
  page: vi.fn(),
  list: vi.fn(),
  remove: vi.fn(),
  decks: vi.fn(),
  createDeck: vi.fn(),
  updateDeck: vi.fn(),
  deleteDeck: vi.fn(),
  bulkDelete: vi.fn(),
  bulkMove: vi.fn(),
  getReviewQueue: vi.fn(),
  get: vi.fn(),
  upsert: vi.fn(),
  autoFillWord: vi.fn(),
  generateExamples: vi.fn(),
  generateDeepDive: vi.fn(),
  submitReview: vi.fn(),
  importCsv: vi.fn(),
  catalog: vi.fn(),
  catalogWords: vi.fn(),
  cloneCatalog: vi.fn(),
  chat: vi.fn(),
  promptsList: vi.fn(),
  promptsCreate: vi.fn(),
  promptsUpdate: vi.fn(),
  promptsDelete: vi.fn(),
  checkPronunciation: vi.fn(),
}))

const offlineMocks = vi.hoisted(() => ({
  getDictionaryWord: vi.fn(),
  saveDictionaryWord: vi.fn(),
  saveDictionaryPage: vi.fn(),
  getDictionaryPage: vi.fn(),
  saveDictionary: vi.fn(),
  getDictionary: vi.fn(),
  saveDecks: vi.fn(),
  getDecks: vi.fn(),
  invalidateDictionaryCache: vi.fn(),
}))

const authState = vi.hoisted(() => ({
  user: { id: 1 } as { id: number } | null,
  isSingleMode: false,
}))

const settingsState = vi.hoisted(() => ({
  appLanguage: 'ru',
}))

vi.mock('~/01.shared/services/api.service', () => ({ api: { dictionary: apiMocks } }))
vi.mock('~/01.shared/services/offline.service', () => ({ offlineService: offlineMocks }))
vi.mock('~/01.shared/store/auth.store', () => ({ useAuthStore: () => authState }))
vi.mock('~/01.shared/store/settings.store', () => ({ useGlobalSettingsStore: () => settingsState }))

const card = UserDictItemSchema.parse({
  id: 1,
  deckIds: [10],
  word: 'gift',
  language: 'en',
  due: '2030-01-01',
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
})

const secondCard = UserDictItemSchema.parse({
  id: 2,
  deckIds: [10, 20],
  word: 'apple',
  language: 'de',
  due: '2030-01-01',
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
})

const deck = DictDeckSchema.parse({
  id: 10,
  userId: 1,
  name: 'Core',
  language: 'en',
  createdAt: '2026-01-01',
})

describe('dictionary repository offline links', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    authState.user = { id: 1 }
    authState.isSingleMode = false
    settingsState.appLanguage = 'ru'
    offlineMocks.getDictionaryWord.mockResolvedValue(card)
    offlineMocks.saveDictionaryWord.mockResolvedValue(undefined)
    offlineMocks.saveDictionaryPage.mockResolvedValue(undefined)
    offlineMocks.saveDictionary.mockResolvedValue(undefined)
    offlineMocks.saveDecks.mockResolvedValue(undefined)
    offlineMocks.invalidateDictionaryCache.mockResolvedValue(undefined)
  })

  it('uses individual offline cache for legacy links without source language', async () => {
    apiMocks.get.mockRejectedValue(new TypeError('Failed to fetch'))
    expect(await new DefaultDictionaryRepository().get('gift')).toEqual(card)
    expect(offlineMocks.getDictionaryWord).toHaveBeenCalledWith('gift', undefined)
  })

  it('does not hide ambiguous or unauthorized server responses with cached entries', async () => {
    for (const status of [401, 404, 409]) {
      const error = Object.assign(new Error('Server rejected lookup'), { status })
      apiMocks.get.mockRejectedValue(error)
      await expect(new DefaultDictionaryRepository().get('gift')).rejects.toBe(error)
    }

    expect(offlineMocks.getDictionaryWord).not.toHaveBeenCalled()
  })

  it('saves validated word on get and rejects when session scope changes mid-flight', async () => {
    const repo = new DefaultDictionaryRepository()
    apiMocks.get.mockResolvedValueOnce(card)
    await expect(repo.get('gift', 'en')).resolves.toEqual(card)
    expect(offlineMocks.saveDictionaryWord).toHaveBeenCalledWith(card)

    apiMocks.get.mockImplementationOnce(async () => {
      settingsState.appLanguage = 'en'

      return card
    })
    await expect(repo.get('gift', 'en')).rejects.toThrow('Dictionary session changed')
  })

  it('handles page queries for guests, online fetches, scope changes, cached pages, and legacy offline pagination', async () => {
    const repo = new DefaultDictionaryRepository()

    authState.user = null
    await expect(repo.page({ limit: 10 })).resolves.toEqual({
      items: [],
      total: 0,
      totalWords: 0,
      nextOffset: null,
      languages: [],
      deckCounts: [],
    })

    authState.user = { id: 1 }
    const pageData = {
      items: [card],
      total: 1,
      totalWords: 1,
      nextOffset: null,
      languages: ['en'],
      deckCounts: [{ deckId: 10, count: 1 }],
    }
    apiMocks.page.mockResolvedValueOnce(pageData)
    await expect(repo.page({ limit: 10 })).resolves.toEqual(pageData)
    expect(offlineMocks.saveDictionaryPage).toHaveBeenCalledWith({ limit: 10 }, pageData)

    apiMocks.page.mockImplementationOnce(async () => {
      authState.user = { id: 2 }

      return pageData
    })
    await expect(repo.page({ limit: 10 })).rejects.toThrow('Dictionary session changed')

    apiMocks.page.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    offlineMocks.getDictionaryPage.mockResolvedValueOnce(pageData)
    await expect(repo.page({ limit: 10 })).resolves.toEqual(pageData)

    // Legacy offline fallback paginates the full dictionary snapshot
    apiMocks.page.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    offlineMocks.getDictionaryPage.mockResolvedValueOnce(null)
    offlineMocks.getDictionary.mockResolvedValueOnce([card, secondCard])
    await expect(repo.page({ limit: 1, offset: 0 })).resolves.toEqual({
      items: [card],
      total: 2,
      totalWords: 2,
      nextOffset: 1,
      languages: ['en', 'de'],
      deckCounts: [
        { deckId: 10, count: 2 },
        { deckId: 20, count: 1 },
      ],
    })
  })

  it('handles list and getDecks for guests, online fetches, and offline fallbacks', async () => {
    const repo = new DefaultDictionaryRepository()

    authState.user = null
    await expect(repo.list()).resolves.toEqual([])
    await expect(repo.getDecks()).resolves.toEqual([])

    authState.user = { id: 1 }
    apiMocks.list.mockResolvedValueOnce([card])
    await expect(repo.list()).resolves.toEqual([card])
    expect(offlineMocks.saveDictionary).toHaveBeenCalledWith([card])

    apiMocks.list.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    offlineMocks.getDictionary.mockResolvedValueOnce([card])
    await expect(repo.list()).resolves.toEqual([card])

    apiMocks.decks.mockResolvedValueOnce([deck])
    await expect(repo.getDecks()).resolves.toEqual([deck])
    expect(offlineMocks.saveDecks).toHaveBeenCalledWith([deck])

    apiMocks.decks.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    offlineMocks.getDecks.mockResolvedValueOnce([deck])
    await expect(repo.getDecks()).resolves.toEqual([deck])
  })

  it('invalidates offline cache on mutations only while cache scope matches', async () => {
    const repo = new DefaultDictionaryRepository()
    apiMocks.remove.mockResolvedValueOnce({ success: true })
    await expect(repo.remove('gift', 'en')).resolves.toEqual({ success: true })
    expect(offlineMocks.invalidateDictionaryCache).toHaveBeenCalledTimes(1)

    apiMocks.createDeck.mockImplementationOnce(async () => {
      authState.user = { id: 99 }

      return deck
    })
    await expect(repo.createDeck({ name: 'Core', language: 'en' })).resolves.toEqual(deck)
    expect(offlineMocks.invalidateDictionaryCache).toHaveBeenCalledTimes(1)
  })

  it('validates book deck, review queue, catalog, prompts and delegates remaining methods', async () => {
    const repo = new DefaultDictionaryRepository()
    const controller = new AbortController()
    const audio = new Blob(['audio'])

    const bookDeckWord = {
      word: 'gift',
      count: 3,
      forms: ['gift', 'gifts'],
      properName: false,
      contexts: [{ sentence: 'A gift.', page: 1 }],
      source: 'generated' as const,
      content: {
        translation: 'подарок',
        transcription: 'ɡɪft',
        difficulty: 'A1',
        tags: 'noun',
        grammarNote: '',
        vocabularyNote: '',
      },
    }
    const draft = {
      id: 'draft-1',
      bookId: 5,
      name: 'Book Deck',
      language: 'en',
      targetLanguage: 'ru',
      words: [bookDeckWord],
      deckId: null,
    }

    apiMocks.openBookDeck.mockResolvedValue(draft)
    apiMocks.generateBookDeckWord.mockResolvedValue(bookDeckWord)
    apiMocks.saveBookDeck.mockResolvedValue({ deckId: 12 })
    apiMocks.updateDeck.mockResolvedValue({ success: true })
    apiMocks.deleteDeck.mockResolvedValue({ success: true })
    apiMocks.bulkDelete.mockResolvedValue({ success: true })
    apiMocks.bulkMove.mockResolvedValue({ success: true })
    apiMocks.getReviewQueue.mockResolvedValue([card])
    apiMocks.upsert.mockResolvedValue({ success: true })
    apiMocks.autoFillWord.mockResolvedValue({ translation: 'подарок' })
    apiMocks.generateExamples.mockResolvedValue({ examples: [] })
    apiMocks.generateDeepDive.mockResolvedValue({ items: [] })
    apiMocks.submitReview.mockResolvedValue({ success: true })
    apiMocks.importCsv.mockResolvedValue({ success: true })
    apiMocks.catalog.mockResolvedValue([{ id: 1, name: 'HSK 1' }])
    apiMocks.catalogWords.mockResolvedValue([{ id: 1, word: '你好' }])
    apiMocks.cloneCatalog.mockResolvedValue({ success: true, deckId: 5 })
    apiMocks.chat.mockResolvedValue({ response: 'hello' })
    apiMocks.promptsList.mockResolvedValue([{ id: 1, name: 'Default', prompt: 'Explain' }])
    apiMocks.promptsCreate.mockResolvedValue({ id: 2, name: 'P', prompt: 'Text' })
    apiMocks.promptsUpdate.mockResolvedValue({ id: 2, name: 'P2', prompt: 'Text' })
    apiMocks.promptsDelete.mockResolvedValue({ success: true })
    apiMocks.checkPronunciation.mockResolvedValue({ score: 95, heardText: 'gift' })

    await expect(repo.openBookDeck(5, true)).resolves.toEqual(draft)
    await expect(repo.generateBookDeckWord(
      'draft-1',
      'gift',
      true,
      controller.signal,
    )).resolves.toEqual(bookDeckWord)
    await expect(repo.saveBookDeck(
      'draft-1',
      'Deck',
      ['gift'],
      false,
    )).resolves.toEqual({ deckId: 12 })
    await repo.saveLocalDictionary([card])
    await expect(repo.updateDeck(10, { name: 'Renamed' })).resolves.toEqual({ success: true })
    await expect(repo.deleteDeck(10, 'keep')).resolves.toEqual({ success: true })
    await repo.saveLocalDecks([deck])
    await expect(repo.bulkDelete([1])).resolves.toEqual({ success: true })
    await expect(repo.bulkMove([1], [10])).resolves.toEqual({ success: true })
    await expect(repo.getReviewQueue({ lang: 'en', mode: 'srs' })).resolves.toEqual([card])
    await expect(repo.upsert({ word: 'gift' })).resolves.toEqual({ success: true })
    await expect(repo.autoFillWord('gift', 'en')).resolves.toEqual({ translation: 'подарок' })
    await expect(repo.generateExamples('gift', 'en')).resolves.toEqual({ examples: [] })
    await expect(repo.generateDeepDive('gift', 'en', 'collocations')).resolves.toEqual({ items: [] })
    await expect(repo.submitReview(1, 3)).resolves.toEqual({ success: true })
    await expect(repo.importCsv([])).resolves.toEqual({ success: true })
    await expect(repo.catalog()).resolves.toEqual([{
      id: 1,
      name: 'HSK 1',
      language: 'en',
      targetLanguage: 'ru',
      wordCount: 0,
    }])
    await expect(repo.catalogWords(1)).resolves.toEqual([{ id: 1, word: '你好' }])
    await expect(repo.cloneCatalog(1)).resolves.toEqual({ success: true, deckId: 5 })
    await expect(repo.chat({ word: 'gift', language: 'en' })).resolves.toEqual({ response: 'hello' })
    await expect(repo.promptsList()).resolves.toEqual([{ id: 1, name: 'Default', prompt: 'Explain' }])
    await expect(repo.promptsCreate({ name: 'P', prompt: 'Text' })).resolves.toEqual({ id: 2, name: 'P', prompt: 'Text' })
    await expect(repo.promptsUpdate(2, { name: 'P2' })).resolves.toEqual({ id: 2, name: 'P2', prompt: 'Text' })
    await expect(repo.promptsDelete(2)).resolves.toEqual({ success: true })
    await expect(repo.checkPronunciation('gift', 'en', audio)).resolves.toEqual({ score: 95, heardText: 'gift' })
  })
})
