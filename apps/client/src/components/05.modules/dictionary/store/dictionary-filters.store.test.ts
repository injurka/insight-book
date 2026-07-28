import type { UserDictItem } from '~/shared/types/models'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Mock dependencies of the dictionary-filters store.
// The real dictionary store pulls in @pinia/colada queries, auth and other
// stores, so we replace it with a simple mutable holder of `words`.

const toastSuccess = vi.fn()
const toastError = vi.fn()
const trackEvent = vi.fn()
const bulkDeleteRepo = vi.fn().mockResolvedValue(undefined)
const bulkMoveRepo = vi.fn().mockResolvedValue(undefined)

const dictStoreMock: { words: UserDictItem[] } = { words: [] }

vi.mock('~/shared/composables/use-toast', () => ({
  useToast: () => ({ success: toastSuccess, error: toastError }),
}))

vi.mock('~/shared/composables/use-umami', () => ({
  useUmami: () => ({ trackEvent }),
}))

vi.mock('~/shared/plugins/di', () => ({
  useRepos: () => ({
    dictionary: {
      bulkDelete: bulkDeleteRepo,
      bulkMove: bulkMoveRepo,
    },
  }),
}))

vi.mock('./dictionary.store', () => ({
  useDictionaryStore: () => dictStoreMock,
}))

const { useDictionaryFiltersStore } = await import('./dictionary-filters.store')

function makeWord(partial: Partial<UserDictItem> & { id: number, word: string }): UserDictItem {
  return {
    deckIds: [],
    transcription: null,
    translation: null,
    language: 'en',
    targetLanguage: 'ru',
    notes: null,
    tags: null,
    difficulty: null,
    grammarNote: null,
    vocabularyNote: null,
    state: 0,
    due: '2024-01-01',
    stability: 0,
    difficultyFsrs: 0,
    scheduledDays: 0,
    reps: 0,
    lapses: 0,
    lastReview: null,
    learningSteps: 0,
    createdAt: '2024-01-01',
    ...partial,
  } as UserDictItem
}

const testWords: UserDictItem[] = [
  makeWord({
    id: 1,
    word: 'Apple',
    language: 'en',
    deckIds: [1],
    difficulty: 'A1',
    state: 0,
    translation: 'яблоко',
  }),
  makeWord({
    id: 2,
    word: 'Banana',
    language: 'en',
    deckIds: [1, 2],
    difficulty: 'A2',
    state: 1,
    tags: 'fruit, food',
  }),
  makeWord({
    id: 3,
    word: 'Cat',
    language: 'en',
    deckIds: [],
    difficulty: null,
    state: 2,
    transcription: 'kæt',
  }),
  makeWord({
    id: 4,
    word: '苹果',
    language: 'zh',
    deckIds: [2],
    difficulty: 'HSK 3',
    state: 2,
    translation: 'apple',
  }),
  makeWord({
    id: 5,
    word: '猫',
    language: 'ja',
    deckIds: [3],
    difficulty: 'N5',
    state: 3,
    notes: 'neko',
  }),
  makeWord({
    id: 6,
    word: 'Dog',
    language: 'en',
    deckIds: [3],
    difficulty: 'B1',
    state: 3,
    translation: 'собака',
    notes: 'Pet animal',
  }),
  makeWord({
    id: 7,
    word: '水',
    language: 'zh',
    deckIds: [],
    difficulty: 'HSK 1',
    state: 0,
    translation: 'water',
  }),
]

describe('dictionary-filters store', () => {
  let store: ReturnType<typeof useDictionaryFiltersStore>

  beforeEach(() => {
    setActivePinia(createPinia())
    // Clone words so store mutations (bulkMoveToDecks) do not leak between tests
    dictStoreMock.words = testWords.map(w => ({ ...w, deckIds: [...w.deckIds] }))
    vi.clearAllMocks()
    store = useDictionaryFiltersStore()
  })

  describe('filteredWords - default state', () => {
    it('returns all words when no filters are applied', () => {
      expect(store.filteredWords).toHaveLength(7)
      expect(store.filteredWords.map(w => w.id)).toEqual([1, 2, 3, 4, 5, 6, 7])
    })

    it('returns an empty array when the dictionary is empty', () => {
      dictStoreMock.words = []
      expect(store.filteredWords).toEqual([])
    })
  })

  describe('filteredWords - search term', () => {
    it('filters by word substring case-insensitively', () => {
      store.searchTerm = 'apple'
      expect(store.filteredWords.map(w => w.id)).toEqual([1, 4])
    })

    it('matches against uppercase search term', () => {
      store.searchTerm = 'APPLE'
      expect(store.filteredWords.map(w => w.id)).toEqual([1, 4])
    })

    it('matches against translation', () => {
      store.searchTerm = 'собака'
      expect(store.filteredWords.map(w => w.id)).toEqual([6])
    })

    it('matches against transcription', () => {
      store.searchTerm = 'KÆT'
      expect(store.filteredWords.map(w => w.id)).toEqual([3])
    })

    it('matches against notes and tags', () => {
      store.searchTerm = 'neko'
      expect(store.filteredWords.map(w => w.id)).toEqual([5])

      store.searchTerm = 'FRUIT'
      expect(store.filteredWords.map(w => w.id)).toEqual([2])
    })

    it('matches against difficulty value', () => {
      store.searchTerm = 'hsk 3'
      expect(store.filteredWords.map(w => w.id)).toEqual([4])
    })

    it('returns empty array when nothing matches', () => {
      store.searchTerm = 'nonexistent-term'
      expect(store.filteredWords).toEqual([])
    })
  })

  describe('filteredWords - language filter', () => {
    it('filters by a single language', () => {
      store.selectedLanguage = 'zh'
      expect(store.filteredWords.map(w => w.id)).toEqual([4, 7])
    })

    it('returns empty array for a language with no words', () => {
      store.selectedLanguage = 'ko'
      expect(store.filteredWords).toEqual([])
    })

    it('exposes available languages derived from words', () => {
      expect([...store.availableLanguages].sort()).toEqual(['en', 'ja', 'zh'])
    })
  })

  describe('filteredWords - deck filter', () => {
    it('filters by a single deck id', () => {
      store.selectedDeckId = [1]
      expect(store.filteredWords.map(w => w.id)).toEqual([1, 2])
    })

    it('matches words belonging to any of the selected decks', () => {
      store.selectedDeckId = [2, 3]
      expect(store.filteredWords.map(w => w.id)).toEqual([2, 4, 5, 6])
    })

    it('filters words without any deck when "none" is selected', () => {
      store.selectedDeckId = ['none']
      expect(store.filteredWords.map(w => w.id)).toEqual([3, 7])
    })

    it('combines "none" with concrete deck ids', () => {
      store.selectedDeckId = ['none', 3]
      expect(store.filteredWords.map(w => w.id)).toEqual([3, 5, 6, 7])
    })

    it('does not filter when selection is empty or contains "all"', () => {
      store.selectedDeckId = []
      expect(store.filteredWords).toHaveLength(7)

      store.selectedDeckId = ['all']
      expect(store.filteredWords).toHaveLength(7)
    })
  })

  describe('filteredWords - difficulty filter', () => {
    it('filters by exact difficulty value', () => {
      store.selectedDifficulty = ['A1']
      expect(store.filteredWords.map(w => w.id)).toEqual([1])
    })

    it('filters words without difficulty when "none" is selected', () => {
      store.selectedDifficulty = ['none']
      expect(store.filteredWords.map(w => w.id)).toEqual([3])
    })

    it('filters by difficulty level across language systems', () => {
      // level_1 maps to A1 (default), HSK 1 (zh), N5 (ja)
      store.selectedDifficulty = ['level_1']
      expect(store.filteredWords.map(w => w.id)).toEqual([1, 5, 7])
    })

    it('combines exact value with "none"', () => {
      store.selectedDifficulty = ['A2', 'none']
      expect(store.filteredWords.map(w => w.id)).toEqual([2, 3])
    })

    it('does not filter when selection is empty or contains "all"', () => {
      store.selectedDifficulty = []
      expect(store.filteredWords).toHaveLength(7)

      store.selectedDifficulty = ['all']
      expect(store.filteredWords).toHaveLength(7)
    })
  })

  describe('filteredWords - status filter', () => {
    it('filters by a single state', () => {
      store.selectedStatus = ['0']
      expect(store.filteredWords.map(w => w.id)).toEqual([1, 7])
    })

    it('filters by multiple states', () => {
      store.selectedStatus = ['2', '3']
      expect(store.filteredWords.map(w => w.id)).toEqual([3, 4, 5, 6])
    })

    it('does not filter when selection is empty or contains "all"', () => {
      store.selectedStatus = []
      expect(store.filteredWords).toHaveLength(7)

      store.selectedStatus = ['all']
      expect(store.filteredWords).toHaveLength(7)
    })
  })

  describe('filteredWords - combined filters', () => {
    it('applies language and status filters together', () => {
      store.selectedLanguage = 'en'
      store.selectedStatus = ['3']
      expect(store.filteredWords.map(w => w.id)).toEqual([6])
    })

    it('applies search, deck and status filters together', () => {
      store.selectedDeckId = [3]
      store.selectedStatus = ['3']
      store.searchTerm = 'PET'
      expect(store.filteredWords.map(w => w.id)).toEqual([6])
    })

    it('applies language, difficulty level and deck filters together', () => {
      store.selectedLanguage = 'zh'
      store.selectedDifficulty = ['level_1']
      store.selectedDeckId = ['none']
      expect(store.filteredWords.map(w => w.id)).toEqual([7])
    })

    it('returns empty array when combined filters exclude everything', () => {
      store.selectedLanguage = 'ja'
      store.selectedStatus = ['0']
      expect(store.filteredWords).toEqual([])
    })

    it('restores all words after filters are reset', () => {
      store.searchTerm = 'apple'
      store.selectedLanguage = 'en'
      store.selectedDeckId = [1]
      store.selectedDifficulty = ['A1']
      store.selectedStatus = ['0']
      expect(store.filteredWords.map(w => w.id)).toEqual([1])

      store.searchTerm = ''
      store.selectedLanguage = 'all'
      store.selectedDeckId = ['all']
      store.selectedDifficulty = ['all']
      store.selectedStatus = ['all']
      expect(store.filteredWords).toHaveLength(7)
    })
  })

  describe('word selection', () => {
    it('toggles word selection on and off', () => {
      store.toggleWordSelection(1)
      store.toggleWordSelection(2)
      expect([...store.selectedWordIds].sort()).toEqual([1, 2])

      store.toggleWordSelection(1)
      expect([...store.selectedWordIds]).toEqual([2])
    })

    it('clears the whole selection', () => {
      store.toggleWordSelection(1)
      store.toggleWordSelection(2)
      store.clearSelection()
      expect(store.selectedWordIds.size).toBe(0)
    })

    it('selects only the currently filtered words', () => {
      store.selectedLanguage = 'zh'
      store.selectAllFiltered()
      expect([...store.selectedWordIds].sort()).toEqual([4, 7])
    })
  })

  describe('bulkDelete', () => {
    it('does nothing when selection is empty', async () => {
      await store.bulkDelete()
      expect(bulkDeleteRepo).not.toHaveBeenCalled()
      expect(toastSuccess).not.toHaveBeenCalled()
    })

    it('deletes selected words via repo and updates the dictionary store', async () => {
      store.toggleWordSelection(1)
      store.toggleWordSelection(7)
      await store.bulkDelete()

      expect(bulkDeleteRepo).toHaveBeenCalledWith([1, 7])
      expect(dictStoreMock.words.map(w => w.id)).toEqual([2, 3, 4, 5, 6])
      expect(store.selectedWordIds.size).toBe(0)
      expect(toastSuccess).toHaveBeenCalledWith('Удалено 2 слов')
      expect(trackEvent).toHaveBeenCalledWith('bulk_words_deleted', { count: 2 })
    })

    it('shows an error toast when the repo call fails', async () => {
      bulkDeleteRepo.mockRejectedValueOnce(new Error('network'))
      store.toggleWordSelection(1)
      await store.bulkDelete()

      expect(toastError).toHaveBeenCalledWith('Ошибка удаления')
      expect(toastSuccess).not.toHaveBeenCalled()
      expect(dictStoreMock.words).toHaveLength(7)
    })
  })

  describe('bulkMoveToDecks', () => {
    it('does nothing when selection is empty', async () => {
      await store.bulkMoveToDecks([2])
      expect(bulkMoveRepo).not.toHaveBeenCalled()
    })

    it('moves selected words to the given decks', async () => {
      store.toggleWordSelection(1)
      store.toggleWordSelection(3)
      await store.bulkMoveToDecks([9])

      expect(bulkMoveRepo).toHaveBeenCalledWith([1, 3], [9])
      expect(dictStoreMock.words.find(w => w.id === 1)?.deckIds).toEqual([9])
      expect(dictStoreMock.words.find(w => w.id === 3)?.deckIds).toEqual([9])
      expect(store.selectedWordIds.size).toBe(0)
      expect(toastSuccess).toHaveBeenCalledWith('Перемещено 2 слов')
      expect(trackEvent).toHaveBeenCalledWith('bulk_words_moved', { count: 2 })
    })

    it('shows an error toast when the repo call fails', async () => {
      bulkMoveRepo.mockRejectedValueOnce(new Error('network'))
      store.toggleWordSelection(1)
      await store.bulkMoveToDecks([9])

      expect(toastError).toHaveBeenCalledWith('Ошибка перемещения')
      expect(dictStoreMock.words.find(w => w.id === 1)?.deckIds).toEqual([1])
    })
  })
})
