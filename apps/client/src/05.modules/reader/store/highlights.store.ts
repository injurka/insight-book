import type { Highlight, LlmAnalysis } from '~/01.shared/types/models'
import { useMutation, useQuery, useQueryCache } from '@pinia/colada'
import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { useRepos } from '~/00.plugins/di'
import { queryKeys } from '~/01.shared/lib/query-keys'

export type { Highlight }

export const useHighlightsStore = defineStore('highlights', () => {
  const repos = useRepos()
  const queryCache = useQueryCache()
  const currentBookId = ref<number | null>(null)
  const highlights = ref<Highlight[]>([])
  const isLoading = ref(false)

  const {
    data: highlightsData,
    isLoading: isQueryLoading,
    refetch: refetchHighlightsQuery,
  } = useQuery<Highlight[]>({
    key: () => queryKeys.highlights(currentBookId.value),
    query: async () => {
      const id = currentBookId.value
      if (id === null)
        return []

      return repos.highlights.list(id)
    },
    enabled: () => currentBookId.value !== null,
  })

  // Map highlights.value to the query result using a watch watcher
  watch(highlightsData, (newData) => {
    if (newData)
      highlights.value = [...newData]

    else
      highlights.value = []
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
    mutation: async (data: Parameters<typeof repos.highlights.create>[0]) => repos.highlights.create(data),
    async onSuccess(newHighlight, variables) {
      const bookId = newHighlight.bookId || variables.bookId

      // Update local state and save offline
      const exists = highlights.value.some(item => item.id === newHighlight.id)
      if (!exists)
        highlights.value.push(newHighlight)

      await repos.highlights.saveLocalHighlights(bookId, highlights.value)

      // Invalidate queries
      queryCache.invalidateQueries({ key: queryKeys.highlights(bookId) })
    },
  })

  const { mutateAsync: deleteHighlightMutation } = useMutation({
    mutation: async (id: number) => repos.highlights.delete(id),
    async onSuccess(_, id) {
      const bookId = highlights.value.find(item => item.id === id)?.bookId || currentBookId.value

      // Update local state
      highlights.value = highlights.value.filter(item => item.id !== id)

      // Save offline
      if (bookId !== null) {
        await repos.highlights.saveLocalHighlights(bookId, highlights.value)

        // Invalidate queries
        queryCache.invalidateQueries({ key: queryKeys.highlights(bookId) })
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
