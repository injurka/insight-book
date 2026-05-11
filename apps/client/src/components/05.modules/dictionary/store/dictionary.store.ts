import type { UserDictItem } from '~/shared/types/models'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { useToast } from '~/shared/composables/use-toast'
import { api } from '~/shared/services/api.service'
import { offlineService } from '~/shared/services/offline.service'
import { useAnalysisStore } from '~/shared/store/analysis.store'

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
      await offlineService.saveDictionary(words.value)
    }
    catch (e) {
      const cached = await offlineService.getDictionary()
      if (cached) {
        words.value = cached
      }
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
    const analysisStore = useAnalysisStore()
    analysisStore.wordToEdit = word
    analysisStore.addEditWordModalOpen = true
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
