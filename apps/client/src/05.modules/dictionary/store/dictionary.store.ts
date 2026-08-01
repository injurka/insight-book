import type { DictDeck, UserDictItem } from '~/01.shared/types/models'
import { useMutation, useQuery, useQueryCache } from '@pinia/colada'
import { useRepos } from '~/00.plugins/di'
import { useToast } from '~/01.shared/composables/use-toast'
import { queryKeys } from '~/01.shared/lib/query-keys'
import { useAnalysisStore } from '~/01.shared/store/analysis/analysis.store'
import { useAuthStore } from '~/01.shared/store/auth.store'

import { useDecksStore } from './decks.store'
import { useDictionaryFiltersStore } from './dictionary-filters.store'
import { dictionaryWords } from './dictionary-words.state'

export const useDictionaryStore = defineStore('dictionary', () => {
  const toast = useToast()
  const queryCache = useQueryCache()
  const authStore = useAuthStore()
  const repos = useRepos()

  const decksStore = useDecksStore()
  const filtersStore = useDictionaryFiltersStore()

  const words = dictionaryWords
  const isManualLoading = ref(false)

  // Pinia Colada query for dictionary
  const {
    data: dictionaryData,
    isLoading: isDictionaryLoading,
    refetch: refetchDictionary,
  } = useQuery<UserDictItem[]>({
    key: queryKeys.dictionary.all,
    query: async () => repos.dictionary.list(),
    enabled: () => !!authStore.user || authStore.isSingleMode,
  })

  watch(dictionaryData, (newWords) => {
    if (newWords)
      words.value = newWords
  }, { immediate: true })

  const decks = computed<DictDeck[]>({
    get: () => decksStore.decks,
    set: (val: DictDeck[]) => { decksStore.decks = val },
  })
  const searchTerm = computed<string>({
    get: () => filtersStore.searchTerm,
    set: (val: string) => { filtersStore.searchTerm = val },
  })
  const selectedLanguage = computed<string>({
    get: () => filtersStore.selectedLanguage,
    set: (val: string) => { filtersStore.selectedLanguage = val },
  })
  const selectedDeckId = computed<(number | 'all' | 'none')[]>({
    get: () => filtersStore.selectedDeckId,
    set: (val: (number | 'all' | 'none')[]) => { filtersStore.selectedDeckId = val },
  })
  const selectedDifficulty = computed<(string | 'all' | 'none')[]>({
    get: () => filtersStore.selectedDifficulty,
    set: (val: (string | 'all' | 'none')[]) => { filtersStore.selectedDifficulty = val },
  })
  const selectedStatus = computed<('all' | '0' | '1' | '2' | '3')[]>({
    get: () => filtersStore.selectedStatus,
    set: (val: ('all' | '0' | '1' | '2' | '3')[]) => { filtersStore.selectedStatus = val },
  })
  const selectedWordIds = computed<Set<number>>({
    get: () => filtersStore.selectedWordIds,
    set: (val: Set<number>) => { filtersStore.selectedWordIds = val },
  })

  // Computed counts
  const availableLanguages = computed<string[]>(() => filtersStore.availableLanguages)
  const filteredWords = computed<UserDictItem[]>(() => filtersStore.filteredWords)

  async function fetchDictionary() {
    isManualLoading.value = true
    try {
      await Promise.all([
        refetchDictionary(),
        decksStore.fetchDecks(),
      ])
    }
    catch (e) {
      console.warn('Could not fetch dictionary:', e)
    }
    finally {
      isManualLoading.value = false
    }
  }

  const { mutateAsync: deleteWordMutation, isLoading: isDeletingWord } = useMutation({
    mutation: async (word: string) => repos.dictionary.remove(word),
    async onSuccess(_, word) {
      words.value = words.value.filter(w => w.word !== word)
      await repos.dictionary.saveLocalDictionary(words.value)

      queryCache.invalidateQueries({ key: queryKeys.dictionary.all })
      queryCache.invalidateQueries({ key: queryKeys.decks.all })
      toast.success('Слово удалено')
    },
    onError(e) {
      toast.error(e instanceof Error ? e.message : 'Не удалось удалить слово')
    },
  })

  async function deleteWord(word: string) {
    try {
      await deleteWordMutation(word)
    }
    catch {
      // caught
    }
  }

  function openEditModal(word: UserDictItem) {
    const analysisStore = useAnalysisStore()
    analysisStore.wordToEdit = word
    analysisStore.addEditWordModalOpen = true
  }

  // Delegated methods
  const fetchDecks = async () => decksStore.fetchDecks()
  const createDeck = async (name: string, language: string) => decksStore.createDeck(name, language)
  const updateDeck = async (id: number, name: string) => decksStore.updateDeck(id, name)
  const deleteDeck = async (id: number, mode: 'keep' | 'delete_all' | 'delete_exclusive' = 'keep') => decksStore.deleteDeck(id, mode)
  const toggleWordSelection = (id: number) => filtersStore.toggleWordSelection(id)
  const clearSelection = () => filtersStore.clearSelection()
  const selectAllFiltered = () => filtersStore.selectAllFiltered()
  const bulkDelete = async () => filtersStore.bulkDelete()
  const bulkMoveToDecks = async (deckIds: number[]) => filtersStore.bulkMoveToDecks(deckIds)

  const isLoading = computed(() => {
    return isManualLoading.value
      || isDictionaryLoading.value
      || isDeletingWord.value
      || decksStore.isLoading
  })

  return {
    words,
    decks,
    isLoading,
    searchTerm,
    selectedLanguage,
    selectedDeckId,
    selectedDifficulty,
    selectedStatus,
    availableLanguages,
    filteredWords,
    selectedWordIds,

    fetchDictionary,
    fetchDecks,
    createDeck,
    updateDeck,
    deleteDeck,
    deleteWord,
    openEditModal,
    toggleWordSelection,
    clearSelection,
    selectAllFiltered,
    bulkDelete,
    bulkMoveToDecks,
  }
})
