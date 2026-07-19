import { computed, onMounted, ref, watch } from 'vue'
import { useRepos } from '~/shared/plugins/di'

export interface ActionStats {
  action: string
  input: number
  output: number
  cost: number
}

export function useTokenStats() {
  const repos = useRepos()
  const tokensData = ref<{ stats: any[], daily: any[], totalCost: number } | null>(null)
  const isTokensLoading = ref(true)
  const selectedPeriod = ref<'today' | 'week' | 'all'>('all')

  async function fetchTokensInfo() {
    try {
      isTokensLoading.value = true
      tokensData.value = await repos.activity.getTokens(selectedPeriod.value)
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

  watch(selectedPeriod, () => {
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

  const totalCost = computed(() => tokensData.value?.totalCost || 0)

  const tokensByAction = computed<ActionStats[]>(() => {
    if (!tokensData.value)
      return []

    const result = tokensData.value.stats.map(s => ({
      action: s.action,
      input: s.inputTokens,
      output: s.outputTokens,
      cost: s.cost || 0,
    }))

    result.sort((a, b) => (b.input + b.output) - (a.input + a.output))

    return result
  })

  return {
    isTokensLoading,
    totalTokens,
    totalCost,
    tokensByAction,
    selectedPeriod,
    fetchTokensInfo,
  }
}
