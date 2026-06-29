import type { LlmAnalysis } from '~/shared/types/models'
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { api } from '~/shared/services/api.service'

export interface Highlight {
  id: number
  userId: number
  bookId: number
  text: string
  translation?: string | null
  note?: string | null
  color: string
  chapter?: string | null
  pageNum: number
  createdAt: string
}

export const useHighlightsStore = defineStore('highlights', () => {
  const highlights = ref<Highlight[]>([])
  const isLoading = ref(false)

  async function fetchHighlights(bookId: number) {
    isLoading.value = true
    try {
      highlights.value = await api.highlights.list(bookId)
    }
    catch (err) {
      console.error('Failed to fetch highlights', err)
    }
    finally {
      isLoading.value = false
    }
  }

  async function createHighlight(data: {
    bookId: number
    text: string
    color: string
    pageNum: number
    chapter?: string | null
    translation?: string | null
    note?: string | null
    analysisData?: LlmAnalysis | null
  }) {
    try {
      const newHighlight = await api.highlights.create(data)
      highlights.value.push(newHighlight)
      return newHighlight
    }
    catch (err) {
      console.error('Failed to create highlight', err)
      throw err
    }
  }

  async function deleteHighlight(id: number) {
    try {
      await api.highlights.delete(id)
      highlights.value = highlights.value.filter(h => h.id !== id)
    }
    catch (err) {
      console.error('Failed to delete highlight', err)
      throw err
    }
  }

  function clear() {
    highlights.value = []
  }

  return {
    highlights,
    isLoading,
    fetchHighlights,
    createHighlight,
    deleteHighlight,
    clear,
  }
})
