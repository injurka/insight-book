import { computed, type Ref, ref } from 'vue'
import type { Rule, RuleTest } from '../../../shared/types'

export function useRulesTest(
  filteredRules: Ref<Rule[]>,
  allTests: Ref<RuleTest[]>
) {
  const currentTestIndex = ref(0)
  const selectedAnswer = ref<string | null>(null)
  const testSubmitted = ref(false)
  const score = ref(0)

  // 1. Filter tests to only include those corresponding to the active (filtered) rules
  const activeTests = computed(() => {
    const activeRuleIds = filteredRules.value.map(r => r.id)
    return allTests.value.filter(test => activeRuleIds.includes(test.ruleId))
  })

  // 2. Current active test
  const currentTest = computed(() => {
    if (activeTests.value.length === 0) return null
    return activeTests.value[currentTestIndex.value % activeTests.value.length]
  })

  // 3. Rule reference for the current test
  const currentRuleReference = computed(() => {
    if (!currentTest.value) return null
    return filteredRules.value.find(r => r.id === currentTest.value!.ruleId) || null
  })

  const selectAnswer = (ans: string) => {
    if (testSubmitted.value) return
    selectedAnswer.value = ans
  }

  const submitAnswer = () => {
    if (!selectedAnswer.value || !currentTest.value) return
    const correctAns = 'correctAnswer' in currentTest.value ? currentTest.value.correctAnswer : ''
    if (selectedAnswer.value === correctAns) {
      score.value++
    }
  }

  const nextQuestion = () => {
    selectedAnswer.value = null
    testSubmitted.value = false
    currentTestIndex.value++
  }

  const restartTest = () => {
    currentTestIndex.value = 0
    selectedAnswer.value = null
    testSubmitted.value = false
    score.value = 0
  }

  return {
    activeTests,
    currentTestIndex,
    selectedAnswer,
    testSubmitted,
    score,
    currentTest,
    currentRuleReference,
    selectAnswer,
    submitAnswer,
    nextQuestion,
    restartTest
  }
}

