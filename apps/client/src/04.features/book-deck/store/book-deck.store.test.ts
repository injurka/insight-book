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
    expect(mocks.generateBookDeckWord).toHaveBeenCalledWith(
      'draft',
      'cat',
      true,
      expect.any(AbortSignal),
    )
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
    expect(mocks.generateBookDeckWord).toHaveBeenCalledExactlyOnceWith(
      'draft',
      'bird',
      false,
      expect.any(AbortSignal),
    )
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
    expect(mocks.generateBookDeckWord).toHaveBeenLastCalledWith(
      'draft',
      'bird',
      false,
      expect.any(AbortSignal),
    )
    expect(store.pending).toHaveLength(0)
  })
  it('retries LLM_ERROR until success and continues the queue', async () => {
    vi.useFakeTimers()

    try {
      const store = useBookDeckStore()
      await store.open(1)
      store.setSelected(['cat', 'bird'], true)
      const llmError = Object.assign(new Error('Ошибка при работе с ИИ'), { code: 'LLM_ERROR', status: 500 })

      mocks.generateBookDeckWord
        .mockRejectedValueOnce(llmError)
        .mockRejectedValueOnce(llmError)
        .mockResolvedValueOnce(generated(word('cat')))
        .mockResolvedValueOnce(generated(word('bird')))

      const run = store.generate()
      await vi.advanceTimersByTimeAsync(1000)
      expect(store.state.retryAttempt).toBeGreaterThanOrEqual(1)
      await vi.advanceTimersByTimeAsync(2000)
      await run

      expect(mocks.generateBookDeckWord).toHaveBeenCalledTimes(4)
      expect(store.pending).toHaveLength(0)
      expect(store.state.done).toBe(2)
      expect(store.state.error).toBe('')
      expect(store.state.errors).toEqual({})
      expect(store.state.retryAttempt).toBe(0)
    }
    finally {
      vi.useRealTimers()
    }
  })
  it('cancels an active generation immediately, aborts the signal and preserves completed words', async () => {
    const store = useBookDeckStore()
    await store.open(1)
    store.setSelected(['cat', 'bird'], true)

    let capturedSignal: AbortSignal | undefined
    mocks.generateBookDeckWord
      .mockResolvedValueOnce(generated(word('cat')))
      .mockImplementationOnce((
        _id: string,
        _word: string,
        _regenerate: boolean,
        signal?: AbortSignal,
      ) => {
        capturedSignal = signal

        return new Promise((_resolve, reject) => {
          signal?.addEventListener('abort', () => {
            const abortError = new Error('Aborted')
            abortError.name = 'AbortError'
            reject(abortError)
          }, { once: true })
        })
      })

    const run = store.generate()
    await vi.waitFor(() => expect(capturedSignal).toBeDefined())
    store.cancel()
    await run

    expect(capturedSignal?.aborted).toBe(true)
    expect(store.state).toMatchObject({
      running: false,
      total: 0,
      done: 0,
      current: '',
      error: '',
      retryAttempt: 0,
    })
    expect(store.pending.map(w => w.word)).toEqual(['bird'])
  })
  it('stops retrying immediately when cancelled during backoff', async () => {
    vi.useFakeTimers()

    try {
      const store = useBookDeckStore()
      await store.open(1)
      store.setSelected(['cat'], true)
      const llmError = Object.assign(new Error('Ошибка при работе с ИИ'), { code: 'LLM_ERROR', status: 500 })
      mocks.generateBookDeckWord.mockRejectedValue(llmError)

      const run = store.generate()
      await vi.waitFor(() => expect(store.state.retryAttempt).toBe(1))
      store.cancel()
      await run

      expect(mocks.generateBookDeckWord).toHaveBeenCalledTimes(1)
      expect(store.state).toMatchObject({
        running: false,
        total: 0,
        done: 0,
        error: '',
        retryAttempt: 0,
      })
      expect(store.state.errors).toEqual({})
    }
    finally {
      vi.useRealTimers()
    }
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
