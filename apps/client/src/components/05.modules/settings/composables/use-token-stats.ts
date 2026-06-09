import { computed, onMounted, ref } from 'vue'
import { api } from '~/shared/services/api.service'

export interface ModelStats {
  model: string
  input: number
  output: number
  actions: { action: string, input: number, output: number }[]
}

export function useTokenStats() {
  const tokensData = ref<{ stats: any[], daily: any[] } | null>(null)
  const isTokensLoading = ref(true)
  const expandedModels = ref<Record<string, boolean>>({})

  async function fetchTokensInfo() {
    try {
      isTokensLoading.value = true
      tokensData.value = await api.activity.getTokens()
    }
    catch (e) {
      console.error('Failed to load token usage:', e)
    }
    finally {
      isTokensLoading.value = false
    }
  }

  onMounted(() => {
    fetchTokensInfo()
  })

  const totalTokens = computed(() => {
    if (!tokensData.value)
      return { input: 0, output: 0 }
    return tokensData.value.stats.reduce((acc, curr) => {
      acc.input += curr.inputTokens
      acc.output += curr.outputTokens
      return acc
    }, { input: 0, output: 0 })
  })

  const tokensByModel = computed<ModelStats[]>(() => {
    if (!tokensData.value)
      return []
    const map = new Map<string, ModelStats>()

    tokensData.value.stats.forEach((s) => {
      if (!map.has(s.model)) {
        map.set(s.model, { model: s.model, input: 0, output: 0, actions: [] })
      }
      const existing = map.get(s.model)!
      existing.input += s.inputTokens
      existing.output += s.outputTokens
      existing.actions.push({
        action: s.action,
        input: s.inputTokens,
        output: s.outputTokens,
      })
    })

    const result = Array.from(map.values()).sort((a, b) => (b.input + b.output) - (a.input + a.output))
    result.forEach((m) => {
      m.actions.sort((a, b) => (b.input + b.output) - (a.input + a.output))
    })

    return result
  })

  function toggleModelExpand(model: string) {
    expandedModels.value[model] = !expandedModels.value[model]
  }

  return {
    isTokensLoading,
    totalTokens,
    tokensByModel,
    expandedModels,
    toggleModelExpand,
    fetchTokensInfo,
  }
}
