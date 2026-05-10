import type { UserDictItem } from '~/shared/types/models'
import { api } from '~/shared/services/api.service'
import { useBooksStore } from '~/shared/store/books.store'

export const useDictionaryStore = defineStore('dictionary', () => {
  const toast = useToast()

  const words = ref<UserDictItem[]>([])
  const isLoading = ref(false)
  const searchTerm = ref('')
  const selectedLanguage = ref('all')

  async function fetchDictionary() {
    isLoading.value = true
    try {
      words.value = await api.dictionary.list()
    }
    finally {
      isLoading.value = false
    }
  }

  async function deleteWord(word: string) {
    try {
      await api.dictionary.remove(word)
      words.value = words.value.filter(w => w.word !== word)
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

    if (searchTerm.value) {
      const lowerTerm = searchTerm.value.toLowerCase()
      result = result.filter((item) => {
        return (
          item.word.toLowerCase().includes(lowerTerm)
          || item.transcription?.toLowerCase().includes(lowerTerm)
          || item.translation?.toLowerCase().includes(lowerTerm)
          || item.notes?.toLowerCase().includes(lowerTerm)
          || item.tags?.toLowerCase().includes(lowerTerm)
        )
      })
    }
    return result
  })

  function openEditModal(word: UserDictItem) {
    const booksStore = useBooksStore()
    booksStore.wordToEdit = word
    booksStore.addEditWordModalOpen = true
  }

  return {
    words,
    isLoading,
    searchTerm,
    selectedLanguage,
    availableLanguages,
    filteredWords,
    fetchDictionary,
    deleteWord,
    openEditModal,
  }
})
