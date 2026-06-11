import type { DictDeck, UserDictItem } from '~/shared/types/models'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { useToast } from '~/shared/composables/use-toast'
import { useUmami } from '~/shared/composables/use-umami'
import { DIFFICULTY_SYSTEMS } from '~/shared/constants/difficulties'
import { api } from '~/shared/services/api.service'
import { offlineService } from '~/shared/services/offline.service'
import { useAnalysisStore } from '~/shared/store/analysis.store'

export const useDictionaryStore = defineStore('dictionary', () => {
  const toast = useToast()
  const { trackEvent } = useUmami()

  const words = ref<UserDictItem[]>([])
  const decks = ref<DictDeck[]>([])
  const selectedWordIds = ref<Set<number>>(new Set())
  const reviewQueue = ref<UserDictItem[]>([])
  const trainingMode = ref<'srs' | 'random'>('srs')

  const isLoading = ref(false)
  const searchTerm = ref('')
  const selectedLanguage = ref('all')
  const selectedDeckId = ref<number | 'all' | 'none'>('all')
  const selectedDifficulty = ref<string | 'all' | 'none'>('all')
  const selectedStatus = ref<'all' | '0' | '1' | '2' | '3'>('all')

  async function fetchDictionary() {
    isLoading.value = true
    try {
      const [wordsData, decksData] = await Promise.all([
        api.dictionary.list(),
        api.dictionary.decks(),
      ])
      words.value = wordsData
      decks.value = decksData
      await offlineService.saveDictionary(words.value)
      await offlineService.saveDecks(decks.value)

      await fetchTrainingQueue({ mode: 'srs', deckId: 'all', difficulty: 'all' })
    }
    catch {
      const cached = await offlineService.getDictionary()
      const cachedDecks = await offlineService.getDecks()

      if (cached)
        words.value = cached

      if (cachedDecks)
        decks.value = cachedDecks
    }
    finally {
      isLoading.value = false
    }
  }

  async function fetchDecks() {
    try {
      decks.value = await api.dictionary.decks()
    }
    catch (e) {
      console.warn('Could not fetch decks:', e)
    }
  }

  async function fetchTrainingQueue(opts: { mode: 'srs' | 'random', deckId: number | 'none' | 'all', difficulty: string }) {
    trainingMode.value = opts.mode
    try {
      let langToFetch = selectedLanguage.value
      if (opts.deckId !== 'all' && opts.deckId !== 'none') {
        const deck = decks.value.find(d => d.id === opts.deckId)
        if (deck)
          langToFetch = deck.language
      }

      const backendDifficulty = opts.difficulty.startsWith('level_') ? 'all' : opts.difficulty

      let queue = await api.dictionary.getReviewQueue({
        lang: langToFetch,
        mode: opts.mode,
        deckId: opts.deckId,
        difficulty: backendDifficulty,
      })

      if (opts.difficulty.startsWith('level_')) {
        const targetLevel = Number.parseInt(opts.difficulty.split('_')[1], 10)
        queue = queue.filter((w) => {
          const sys = DIFFICULTY_SYSTEMS[w.language] || DIFFICULTY_SYSTEMS.default
          const diffDef = sys.find(s => s.value === w.difficulty)
          return diffDef && diffDef.level === targetLevel
        })
      }

      reviewQueue.value = queue
    }
    catch (e) {
      console.warn('Could not fetch queue:', e)
      reviewQueue.value = []
      throw e
    }
  }

  async function createDeck(name: string, language: string) {
    try {
      const newDeck = await api.dictionary.createDeck({ name, language })
      decks.value.push(newDeck)
      toast.success('Колода создана')

      trackEvent('deck_created', { language })

      return newDeck
    }
    catch (e) {
      toast.error(e instanceof Error ? e.message : 'Ошибка создания колоды')
      throw e
    }
  }

  async function updateDeck(id: number, name: string) {
    try {
      await api.dictionary.updateDeck(id, { name })
      const deck = decks.value.find(d => d.id === id)

      if (deck)
        deck.name = name

      trackEvent('deck_updated', { deckId: id })

      toast.success('Название колоды обновлено')
    }
    catch (e) {
      toast.error(e instanceof Error ? e.message : 'Ошибка обновления колоды')
    }
  }

  async function deleteDeck(id: number) {
    try {
      await api.dictionary.deleteDeck(id)
      decks.value = decks.value.filter(d => d.id !== id)
      if (selectedDeckId.value === id)
        selectedDeckId.value = 'all'
      words.value.forEach((w) => {
        if (w.deckId === id)
          w.deckId = null
      })
      toast.success('Колода удалена')

      trackEvent('deck_deleted', { deckId: id })
    }
    catch (e) {
      toast.error(e instanceof Error ? e.message : 'Ошибка удаления колоды')
    }
  }

  async function deleteWord(word: string) {
    try {
      await api.dictionary.remove(word)
      words.value = words.value.filter(w => w.word !== word)
      reviewQueue.value = reviewQueue.value.filter(w => w.word !== word)
      toast.success('Слово удалено')

      trackEvent('word_deleted')
    }
    catch (e) {
      toast.error(e instanceof Error ? e.message : 'Не удалось удалить слово')
    }
  }

  const availableLanguages = computed(() => {
    const langs = new Set(words.value.map(w => w.language))
    return Array.from(langs)
  })

  const filteredWords = computed(() => {
    let result = words.value

    if (selectedLanguage.value !== 'all') {
      result = result.filter(w => w.language === selectedLanguage.value)
    }

    if (selectedDeckId.value !== 'all') {
      if (selectedDeckId.value === 'none') {
        result = result.filter(w => w.deckId === null)
      }
      else {
        result = result.filter(w => w.deckId === selectedDeckId.value)
      }
    }

    if (selectedDifficulty.value !== 'all') {
      if (selectedDifficulty.value === 'none') {
        result = result.filter(w => !w.difficulty)
      }
      else if (selectedDifficulty.value.startsWith('level_')) {
        const targetLevel = Number.parseInt(selectedDifficulty.value.split('_')[1], 10)
        result = result.filter((w) => {
          const sys = DIFFICULTY_SYSTEMS[w.language] || DIFFICULTY_SYSTEMS.default
          const diffDef = sys.find(s => s.value === w.difficulty)
          return diffDef && diffDef.level === targetLevel
        })
      }
      else {
        result = result.filter(w => w.difficulty === selectedDifficulty.value)
      }
    }

    if (selectedStatus.value !== 'all') {
      const statusNum = Number.parseInt(selectedStatus.value, 10)
      result = result.filter(w => w.status === statusNum)
    }

    if (searchTerm.value) {
      const lowerTerm = searchTerm.value.toLowerCase()
      result = result.filter(item =>
        item.word.toLowerCase().includes(lowerTerm)
        || item.transcription?.toLowerCase().includes(lowerTerm)
        || item.translation?.toLowerCase().includes(lowerTerm)
        || item.notes?.toLowerCase().includes(lowerTerm)
        || item.tags?.toLowerCase().includes(lowerTerm)
        || item.difficulty?.toLowerCase().includes(lowerTerm),
      )
    }
    return result
  })

  function openEditModal(word: UserDictItem) {
    const analysisStore = useAnalysisStore()
    analysisStore.wordToEdit = word
    analysisStore.addEditWordModalOpen = true
  }

  const newWordsQueueCount = computed(() => reviewQueue.value.filter(w => w.status === 0).length)
  const reviewWordsQueueCount = computed(() => reviewQueue.value.filter(w => w.status > 0).length)
  const totalReviewCount = computed(() => reviewQueue.value.length)

  function toggleWordSelection(id: number) {
    if (selectedWordIds.value.has(id))
      selectedWordIds.value.delete(id)
    else selectedWordIds.value.add(id)
  }

  function clearSelection() {
    selectedWordIds.value.clear()
  }

  function selectAllFiltered() {
    filteredWords.value.forEach(w => selectedWordIds.value.add(w.id))
  }

  async function bulkDelete() {
    const ids = Array.from(selectedWordIds.value)
    if (!ids.length)
      return

    try {
      await api.dictionary.bulkDelete(ids)
      words.value = words.value.filter(w => !ids.includes(w.id))
      clearSelection()
      toast.success(`Удалено ${ids.length} слов`)

      trackEvent('bulk_words_deleted', { count: ids.length })
    }
    catch {
      toast.error('Ошибка удаления')
    }
  }

  async function bulkMoveToDeck(deckId: number | null) {
    const ids = Array.from(selectedWordIds.value)
    if (!ids.length)
      return

    try {
      await api.dictionary.bulkMove(ids, deckId)
      words.value.forEach((w) => {
        if (ids.includes(w.id))
          w.deckId = deckId
      })
      clearSelection()
      toast.success(`Перемещено ${ids.length} слов`)

      trackEvent('bulk_words_moved', { count: ids.length })
    }
    catch {
      toast.error('Ошибка перемещения')
    }
  }

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
    bulkMoveToDeck,
  }
})
