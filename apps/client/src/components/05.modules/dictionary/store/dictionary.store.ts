import type { DictDeck, UserDictItem } from '~/shared/types/models'
import { useMutation, useQuery, useQueryCache } from '@pinia/colada'
import { useToast } from '~/shared/composables/use-toast'
import { useRepos } from '~/shared/plugins/di'
import { useAnalysisStore } from '~/shared/store/analysis/analysis.store'
import { useAuthStore } from '~/shared/store/auth.store'

import { useDecksStore } from './decks.store'
import { useDictionaryFiltersStore } from './dictionary-filters.store'
import { useTrainingStore } from './training.store'

export const useDictionaryStore = defineStore('dictionary', () => {
  const toast = useToast()
  const queryCache = useQueryCache()
  const authStore = useAuthStore()
  const repos = useRepos()

  const words = shallowRef<UserDictItem[]>([])
  const isManualLoading = ref(false)

  // Pinia Colada query for dictionary
  const {
    data: dictionaryData,
    isLoading: isDictionaryLoading,
    refetch: refetchDictionary,
  } = useQuery<UserDictItem[]>({
    key: ['dictionary'],
    query: () => repos.dictionary.list(),
    enabled: () => !!authStore.user || authStore.isSingleMode,
  })

  watch(dictionaryData, (newWords) => {
    if (newWords) {
      words.value = newWords
    }
  }, { immediate: true })

  // Proxied/aliased fields/computed for backward compatibility
  const decks = computed<DictDeck[]>({
    get: () => useDecksStore().decks,
    set: (val: DictDeck[]) => { useDecksStore().decks = val },
  })
  const reviewQueue = computed<UserDictItem[]>({
    get: () => useTrainingStore().reviewQueue,
    set: (val: UserDictItem[]) => { useTrainingStore().reviewQueue = val },
  })
  const trainingMode = computed<'srs' | 'deep_dive' | 'cram' | 'match'>({
    get: () => useTrainingStore().trainingMode,
    set: (val: 'srs' | 'deep_dive' | 'cram' | 'match') => { useTrainingStore().trainingMode = val },
  })
  const searchTerm = computed<string>({
    get: () => useDictionaryFiltersStore().searchTerm,
    set: (val: string) => { useDictionaryFiltersStore().searchTerm = val },
  })
  const selectedLanguage = computed<string>({
    get: () => useDictionaryFiltersStore().selectedLanguage,
    set: (val: string) => { useDictionaryFiltersStore().selectedLanguage = val },
  })
  const selectedDeckId = computed<(number | 'all' | 'none')[]>({
    get: () => useDictionaryFiltersStore().selectedDeckId,
    set: (val: (number | 'all' | 'none')[]) => { useDictionaryFiltersStore().selectedDeckId = val },
  })
  const selectedDifficulty = computed<(string | 'all' | 'none')[]>({
    get: () => useDictionaryFiltersStore().selectedDifficulty,
    set: (val: (string | 'all' | 'none')[]) => { useDictionaryFiltersStore().selectedDifficulty = val },
  })
  const selectedStatus = computed<('all' | '0' | '1' | '2' | '3')[]>({
    get: () => useDictionaryFiltersStore().selectedStatus,
    set: (val: ('all' | '0' | '1' | '2' | '3')[]) => { useDictionaryFiltersStore().selectedStatus = val },
  })
  const selectedWordIds = computed<Set<number>>({
    get: () => useDictionaryFiltersStore().selectedWordIds,
    set: (val: Set<number>) => { useDictionaryFiltersStore().selectedWordIds = val },
  })

  // Computed counts
  const newWordsQueueCount = computed<number>(() => useTrainingStore().newWordsQueueCount)
  const reviewWordsQueueCount = computed<number>(() => useTrainingStore().reviewWordsQueueCount)
  const totalReviewCount = computed<number>(() => useTrainingStore().totalReviewCount)
  const availableLanguages = computed<string[]>(() => useDictionaryFiltersStore().availableLanguages)
  const filteredWords = computed<UserDictItem[]>(() => useDictionaryFiltersStore().filteredWords)

  async function fetchDictionary() {
    isManualLoading.value = true
    try {
      await Promise.all([
        refetchDictionary(),
        useDecksStore().fetchDecks(),
      ])

      await useTrainingStore().fetchTrainingQueue({ mode: 'srs', deckId: 'all', difficulty: ['all'] })
    }
    catch (e) {
      console.warn('Could not fetch dictionary:', e)
    }
    finally {
      isManualLoading.value = false
    }
  }

  const { mutateAsync: deleteWordMutation, isLoading: isDeletingWord } = useMutation({
    mutation: (word: string) => repos.dictionary.remove(word),
    async onSuccess(_, word) {
      words.value = words.value.filter(w => w.word !== word)
      await repos.dictionary.saveLocalDictionary(words.value)

      useTrainingStore().reviewQueue = useTrainingStore().reviewQueue.filter(w => w.word !== word)

      queryCache.invalidateQueries({ key: ['dictionary'] })
      queryCache.invalidateQueries({ key: ['decks'] })
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
  const fetchDecks = () => useDecksStore().fetchDecks()
  const fetchTrainingQueue = (opts: any) => useTrainingStore().fetchTrainingQueue(opts)
  const createDeck = (name: string, language: string) => useDecksStore().createDeck(name, language)
  const updateDeck = (id: number, name: string) => useDecksStore().updateDeck(id, name)
  const deleteDeck = (id: number, mode: 'keep' | 'delete_all' | 'delete_exclusive' = 'keep') => useDecksStore().deleteDeck(id, mode)
  const toggleWordSelection = (id: number) => useDictionaryFiltersStore().toggleWordSelection(id)
  const clearSelection = () => useDictionaryFiltersStore().clearSelection()
  const selectAllFiltered = () => useDictionaryFiltersStore().selectAllFiltered()
  const bulkDelete = () => useDictionaryFiltersStore().bulkDelete()
  const bulkMoveToDecks = (deckIds: number[]) => useDictionaryFiltersStore().bulkMoveToDecks(deckIds)

  const isLoading = computed(() => {
    return isManualLoading.value
      || isDictionaryLoading.value
      || isDeletingWord.value
      || useDecksStore().isLoading
  })

  return {
    words,
    decks,
    reviewQueue,
    trainingMode,
    totalReviewCount,
    newWordsQueueCount,
    reviewWordsQueueCount,
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
    fetchTrainingQueue,
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
