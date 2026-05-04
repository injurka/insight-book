import type { UserDictItem } from '~/shared/types/models'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { api } from '~/shared/services/api.service'
import { useBooksStore } from './books.store'

export const useDictionaryStore = defineStore('dictionary', () => {
  const words = ref<UserDictItem[]>([])
  const isLoading = ref(false)
  const searchTerm = ref('')

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
    await api.dictionary.remove(word)
    words.value = words.value.filter(w => w.word !== word)
  }

  const filteredWords = computed(() => {
    if (!searchTerm.value) {
      return words.value
    }
    const lowerTerm = searchTerm.value.toLowerCase()
    return words.value.filter((item) => {
      return (
        item.word.toLowerCase().includes(lowerTerm)
        || item.pinyin?.toLowerCase().includes(lowerTerm)
        || item.translation?.toLowerCase().includes(lowerTerm)
        || item.notes?.toLowerCase().includes(lowerTerm)
        || item.tags?.toLowerCase().includes(lowerTerm)
      )
    })
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
    filteredWords,
    fetchDictionary,
    deleteWord,
    openEditModal,
  }
})
