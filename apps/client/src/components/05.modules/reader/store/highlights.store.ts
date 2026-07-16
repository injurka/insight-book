import type { LlmAnalysis } from '~/shared/types/models'
import { useMutation, useQueryCache } from '@pinia/colada'
import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { createOfflineQuery } from '~/shared/lib/query'
import { api } from '~/shared/services/api.service'
import { offlineService } from '~/shared/services/offline.service'

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
  const queryCache = useQueryCache()
  const currentBookId = ref<number | null>(null)
  const highlights = ref<Highlight[]>([])
  const isLoading = ref(false)

  const {
    data: highlightsData,
    isLoading: isQueryLoading,
    refetch: refetchHighlightsQuery,
  } = createOfflineQuery<Highlight[]>({
    key: () => ['highlights', currentBookId.value],
    networkQuery: async () => {
      const id = currentBookId.value
      if (id === null)
        return []
      return await api.highlights.list(id) as Highlight[]
    },
    saveOfflineData: async (data) => {
      const id = currentBookId.value
      if (id !== null) {
        await offlineService.saveHighlights(id, data as any)
      }
    },
    getOfflineData: async () => {
      const id = currentBookId.value
      if (id === null)
        return []
      const cached = await offlineService.getHighlights(id)
      return (cached || []) as Highlight[]
    },
    enabled: () => currentBookId.value !== null,
  })

  // Map highlights.value to the query result using a watch watcher
  watch(highlightsData, (newData) => {
    if (newData) {
      highlights.value = [...newData]
    }
    else {
      highlights.value = []
    }
  }, { immediate: true })

  // Map isLoading to isQueryLoading
  watch(isQueryLoading, (val) => {
    isLoading.value = val
  }, { immediate: true })

  async function fetchHighlights(bookId: number) {
    currentBookId.value = bookId
    try {
      await refetchHighlightsQuery()
    }
    catch (err) {
      console.error('Failed to fetch highlights', err)
    }
  }

  const { mutateAsync: createHighlightMutation } = useMutation({
    mutation: (data: {
      bookId: number
      text: string
      color: string
      pageNum: number
      chapter?: string | null
      translation?: string | null
      note?: string | null
      analysisData?: LlmAnalysis | null
    }) => api.highlights.create(data),
    async onSuccess(newHighlight, variables) {
      const bookId = newHighlight.bookId || variables.bookId

      // Update local state and save offline
      const exists = highlights.value.some(h => h.id === newHighlight.id)
      if (!exists) {
        highlights.value.push(newHighlight as any)
      }
      await offlineService.saveHighlights(bookId, highlights.value as any)

      // Invalidate queries
      queryCache.invalidateQueries({ key: ['highlights', bookId] })
    },
  })

  const { mutateAsync: deleteHighlightMutation } = useMutation({
    mutation: (id: number) => api.highlights.delete(id),
    async onSuccess(_, id) {
      const bookId = highlights.value.find(h => h.id === id)?.bookId || currentBookId.value

      // Update local state
      highlights.value = highlights.value.filter(h => h.id !== id)

      // Save offline
      if (bookId !== null) {
        await offlineService.saveHighlights(bookId, highlights.value as any)

        // Invalidate queries
        queryCache.invalidateQueries({ key: ['highlights', bookId] })
      }
    },
  })

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
      return await createHighlightMutation(data) as any
    }
    catch (err) {
      console.error('Failed to create highlight', err)
      throw err
    }
  }

  async function deleteHighlight(id: number) {
    try {
      await deleteHighlightMutation(id)
    }
    catch (err) {
      console.error('Failed to delete highlight', err)
      throw err
    }
  }

  function clear() {
    highlights.value = []
    currentBookId.value = null
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
