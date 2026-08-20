import { computed, ref } from 'vue'
import type { RuleTest } from '../../../shared/types'

export function useMistakeQueue() {
  const mistakes = ref<RuleTest[]>([])
  const mistakeRuleIds = computed(() => new Set(mistakes.value.map(m => m.ruleId)))

  const addMistake = (test: RuleTest) => {
    if (!mistakes.value.some(m => m.id === test.id)) {
      mistakes.value.push(test)
    }
  }

  const removeMistake = (testId: string) => {
    mistakes.value = mistakes.value.filter(m => m.id !== testId)
  }

  const clearMistakes = () => {
    mistakes.value = []
  }

  return {
    mistakes,
    mistakeRuleIds,
    mistakeCount: computed(() => mistakes.value.length),
    addMistake,
    removeMistake,
    clearMistakes
  }
}
