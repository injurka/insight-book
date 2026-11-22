import type { BookDeckDraft, BookDeckWord } from '~/01.shared/types/schemas/book-deck.schema'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useBookDeckStore } from './book-deck.store'

const mocks = vi.hoisted(() => ({ openBookDeck: vi.fn(), generateBookDeckWord: vi.fn(), saveBookDeck: vi.fn(), invalidateQueries: vi.fn() }))
vi.mock('~/00.plugins/di', () => ({ useRepos: () => ({ dictionary: mocks }) }))
vi.mock('@pinia/colada', () => ({ useQueryCache: () => ({ invalidateQueries: mocks.invalidateQueries }) }))
vi.mock('~/01.shared/store/auth.store', () => ({ useAuthStore: () => ({ user: { id: 1 }, isSingleMode: false }) }))
vi.mock('~/01.shared/store/settings.store', () => ({ useGlobalSettingsStore: () => ({ appLanguage: 'ru' }) }))

function word(text: string, properName = false): BookDeckWord {
  return {
    word: text,
    properName,
    count: 2,
    forms: [text],
    contexts: [{ sentence: text, page: 1 }],
    source: 'missing',
    content: null,
  }
}
function draft(): BookDeckDraft {
  return {
    id: 'draft',
    bookId: 1,
    name: 'Book',
    language: 'en',
    targetLanguage: 'ru',
    deckId: null,
    words: [word('cat'), word('bird'), word('Alice', true)],
  }
}
function generated(entry: BookDeckWord): BookDeckWord {
  return {
    ...entry,
    source: 'generated',
    content: {
      translation: 'перевод',
      transcription: '/test/',
      tags: 'action',
      difficulty: 'A1',
      grammarNote: 'Grammar',
      vocabularyNote: 'Vocabulary',
    },
  }
}

describe('book deck queue', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.resetAllMocks()
    mocks.openBookDeck.mockImplementation(async () => draft())
    mocks.saveBookDeck.mockResolvedValue({ deckId: 42 })
  })
  it('starts with an empty selection and keeps explicitly selected words when reopening a draft', async () => {
    const store = useBookDeckStore()
    await store.open(1)
    expect([...store.selected]).toEqual([])
    store.toggle('bird', true)
    await store.open(1)
    expect([...store.selected]).toEqual(['bird'])
  })
  it('explicitly requests a personal regeneration for a ready word', async () => {
    const store = useBookDeckStore()
    await store.open(1)
    store.toggle('cat', true)
    const entry = store.draft!.words[0]!
    Object.assign(entry, generated(entry))
    mocks.generateBookDeckWord.mockResolvedValue(generated(entry))
    await store.generate([entry])
    expect(mocks.generateBookDeckWord).toHaveBeenCalledWith('draft', 'cat', true)
  })
  it('generates and saves only chosen words, even if a stale row asks for generation', async () => {
    const store = useBookDeckStore()
    await store.open(1)
    store.setSelected(['bird'], true)
    expect(store.pending.map(entry => entry.word)).toEqual(['bird'])

    await store.generate([store.draft!.words[0]!])
    expect(mocks.generateBookDeckWord).not.toHaveBeenCalled()

    mocks.generateBookDeckWord.mockResolvedValue(generated(word('bird')))
    await store.generate()
    expect(mocks.generateBookDeckWord).toHaveBeenCalledExactlyOnceWith('draft', 'bird', false)
    await store.save('Book', false)
    expect(mocks.saveBookDeck).toHaveBeenCalledWith(
      'draft',
      'Book',
      ['bird'],
      false,
    )
  })
  it('clears stale generation progress when reopening a draft', async () => {
    const store = useBookDeckStore()
    await store.open(1)
    Object.assign(store.state, { total: 10, done: 4, current: 'old word' })
    await store.open(1)
    expect(store.state).toMatchObject({ total: 0, done: 0, current: '' })
  })
  it('pauses after the current request and resumes only missing content', async () => {
    const store = useBookDeckStore()
    await store.open(1)
    store.setSelected(['cat', 'bird'], true)
    mocks.generateBookDeckWord.mockImplementationOnce(async () => {
      store.state.pause = true

      return generated(word('cat'))
    }).mockResolvedValue(generated(word('bird')))
    await store.generate()
    expect(mocks.generateBookDeckWord).toHaveBeenCalledTimes(1)
    expect(store.pending.map(w => w.word)).toEqual(['bird'])
    await store.generate()
    expect(mocks.generateBookDeckWord).toHaveBeenLastCalledWith('draft', 'bird', false)
    expect(store.pending).toHaveLength(0)
  })
  it('retains completed content after failure, allows retry and blocks incomplete saves', async () => {
    const store = useBookDeckStore()
    await store.open(1)
    store.setSelected(['cat', 'bird'], true)
    mocks.generateBookDeckWord.mockResolvedValueOnce(generated(word('cat'))).mockRejectedValueOnce(new Error('Token limit'))
    await store.generate()
    expect(store.state.errors.bird).toBe('Token limit')
    await store.save('Book', false)
    expect(mocks.saveBookDeck).not.toHaveBeenCalled()
    mocks.generateBookDeckWord.mockResolvedValue(generated(word('bird')))
    await store.generate()
    await store.save('Book', false)
    expect(mocks.saveBookDeck).toHaveBeenCalledWith(
      'draft',
      'Book',
      ['cat', 'bird'],
      false,
    )
    expect(store.draft?.deckId).toBe(42)
    expect(mocks.invalidateQueries).toHaveBeenCalled()
  })
})
