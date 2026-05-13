import type { DictDeck, UserDictItem } from '~/shared/types/models'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { useToast } from '~/shared/composables/use-toast'
import { api } from '~/shared/services/api.service'
import { offlineService } from '~/shared/services/offline.service'
import { useAnalysisStore } from '~/shared/store/analysis.store'

export const useDictionaryStore = defineStore('dictionary', () => {
  const toast = useToast()

  const words = ref<UserDictItem[]>([])
  const decks = ref<DictDeck[]>([])
  const reviewQueue = ref<UserDictItem[]>([])

  const isLoading = ref(false)
  const searchTerm = ref('')
  const selectedLanguage = ref('all')
  const selectedDeckId = ref<number | 'all' | 'none'>('all')
  const selectedStatus = ref<'all' | '0' | '1' | '2' | '3'>('all') // '0': New, '1': Learning, '2': Review, '3': Graduated

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
      await fetchReviewQueue()
    }
    catch {
      const cached = await offlineService.getDictionary()
      if (cached)
        words.value = cached
    }
    finally {
      isLoading.value = false
    }
  }

  async function fetchReviewQueue() {
    try {
      reviewQueue.value = await api.dictionary.getReviewQueue(selectedLanguage.value)
    }
    catch (e) {
      console.warn('Could not fetch review queue:', e)
      reviewQueue.value = []
    }
  }

  async function fetchForceReviewQueue() {
    try {
      reviewQueue.value = await api.dictionary.getReviewQueue(selectedLanguage.value, true)
    }
    catch (e) {
      console.warn('Could not fetch force review queue:', e)
      reviewQueue.value = []
    }
  }

  async function createDeck(name: string, language: string) {
    try {
      const newDeck = await api.dictionary.createDeck({ name, language })
      decks.value.push(newDeck)
      toast.success('Колода создана')
      return newDeck
    }
    catch (e: any) {
      toast.error(e.message || 'Ошибка создания колоды')
      throw e
    }
  }

  async function updateDeck(id: number, name: string) {
    try {
      await api.dictionary.updateDeck(id, { name })
      const deck = decks.value.find(d => d.id === id)
      if (deck)
        deck.name = name
      toast.success('Название колоды обновлено')
    }
    catch (e: any) {
      toast.error(e.message || 'Ошибка обновления колоды')
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
    }
    catch (e: any) {
      toast.error(e.message || 'Ошибка удаления колоды')
    }
  }

  async function deleteWord(word: string) {
    try {
      await api.dictionary.remove(word)
      words.value = words.value.filter(w => w.word !== word)
      reviewQueue.value = reviewQueue.value.filter(w => w.word !== word)
      toast.success('Слово удалено')
    }
    catch (e: any) {
      toast.error(e.message || 'Не удалось удалить слово')
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

  return {
    words,
    decks,
    reviewQueue,
    totalReviewCount,
    newWordsQueueCount,
    reviewWordsQueueCount,
    isLoading,
    searchTerm,
    selectedLanguage,
    selectedDeckId,
    selectedStatus,
    availableLanguages,
    filteredWords,
    fetchDictionary,
    fetchReviewQueue,
    fetchForceReviewQueue,
    createDeck,
    updateDeck,
    deleteDeck,
    deleteWord,
    openEditModal,
  }
})
