import type { DictDeck, UserDictItem } from '~/shared/types/models'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { useToast } from '~/shared/composables/use-toast'
import { api } from '~/shared/services/api.service'
import { offlineService } from '~/shared/services/offline.service'
import { useAnalysisStore } from '~/shared/store/analysis.store'

import { useDecksStore } from './decks.store'
import { useDictionaryFiltersStore } from './dictionary-filters.store'
import { useTrainingStore } from './training.store'

export const useDictionaryStore = defineStore('dictionary', () => {
  const toast = useToast()

  const words = ref<UserDictItem[]>([])
  const isLoading = ref(false)

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
    isLoading.value = true
    try {
      const [wordsData, decksData] = await Promise.all([
        api.dictionary.list(),
        api.dictionary.decks(),
      ])
      words.value = wordsData
      useDecksStore().decks = decksData
      await offlineService.saveDictionary(words.value)
      await offlineService.saveDecks(useDecksStore().decks)

      await useTrainingStore().fetchTrainingQueue({ mode: 'srs', deckId: 'all', difficulty: ['all'] })
    }
    catch {
      const cached = await offlineService.getDictionary()
      const cachedDecks = await offlineService.getDecks()

      if (cached)
        words.value = cached

      if (cachedDecks)
        useDecksStore().decks = cachedDecks
    }
    finally {
      isLoading.value = false
    }
  }

  async function deleteWord(word: string) {
    try {
      await api.dictionary.remove(word)
      words.value = words.value.filter(w => w.word !== word)
      useTrainingStore().reviewQueue = useTrainingStore().reviewQueue.filter(w => w.word !== word)
      toast.success('Слово удалено')
    }
    catch (e) {
      toast.error(e instanceof Error ? e.message : 'Не удалось удалить слово')
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
