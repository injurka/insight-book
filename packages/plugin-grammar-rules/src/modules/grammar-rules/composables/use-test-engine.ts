import { ref, computed, type Ref, watch } from 'vue'
import type {
  AnyRuleTest,
  MultipleChoiceOption,
  MultipleChoiceTest,
  ClozeChoiceTest,
  ClozeInputTest,
  Rule,
  RuleTest,
  SentenceScrambleTest,
  TestResultFeedback
} from '~plugin-grammar-rules/shared/types'

export interface TestEngineOptions {
  onResult?: (ruleId: string, isCorrect: boolean, test: RuleTest) => void
}

export function useTestEngine(
  tests: Ref<RuleTest[]>,
  rules: Ref<Rule[]>,
  options?: TestEngineOptions
) {
  const currentTestIndex = ref(0)
  const isSubmitted = ref(false)
  const score = ref(0)
  const completedCount = ref(0)

  // State for different question types
  const selectedOption = ref<string | null>(null)
  const typedInput = ref('')
  const scrambleAvailableTokens = ref<string[]>([])
  const scrambleSelectedTokens = ref<string[]>([])
  const currentFeedback = ref<TestResultFeedback | null>(null)

  const currentTest = computed<RuleTest | null>(() => {
    if (!tests.value || tests.value.length === 0) return null
    return tests.value[currentTestIndex.value % tests.value.length]
  })

  const currentRule = computed<Rule | null>(() => {
    if (!currentTest.value) return null
    return rules.value.find(r => r.id === currentTest.value!.ruleId) || null
  })

  // Initialize test state on question change
  const initCurrentQuestion = () => {
    selectedOption.value = null
    typedInput.value = ''
    scrambleSelectedTokens.value = []
    currentFeedback.value = null
    isSubmitted.value = false

    if (!currentTest.value) return

    const t = currentTest.value as AnyRuleTest
    if (t.type === 'sentence_scramble') {
      const scrambleTest = t as SentenceScrambleTest
      // Shuffle tokens for scramble pool
      scrambleAvailableTokens.value = [...scrambleTest.tokens].sort(() => Math.random() - 0.5)
    }
  }

  watch(currentTest, () => {
    initCurrentQuestion()
  }, { immediate: true })

  // Multiple Choice / Cloze Choice action
  const selectChoice = (opt: string) => {
    if (isSubmitted.value) return
    selectedOption.value = opt
  }

  // Sentence Scramble actions
  const selectScrambleToken = (tokenIndex: number) => {
    if (isSubmitted.value) return
    const token = scrambleAvailableTokens.value[tokenIndex]
    scrambleAvailableTokens.value.splice(tokenIndex, 1)
    scrambleSelectedTokens.value.push(token)
  }

  const removeScrambleToken = (tokenIndex: number) => {
    if (isSubmitted.value) return
    const token = scrambleSelectedTokens.value[tokenIndex]
    scrambleSelectedTokens.value.splice(tokenIndex, 1)
    scrambleAvailableTokens.value.push(token)
  }

  const hasAnswer = computed(() => {
    if (!currentTest.value) return false
    const t = currentTest.value as AnyRuleTest
    const type = t.type || 'multiple_choice'

    switch (type) {
      case 'multiple_choice':
      case 'cloze_choice':
        return selectedOption.value !== null
      case 'cloze_input':
        return typedInput.value.trim().length > 0
      case 'sentence_scramble':
        return scrambleSelectedTokens.value.length > 0
      default:
        return selectedOption.value !== null
    }
  })

  // Validation & Submission
  const submitAnswer = () => {
    if (isSubmitted.value || !currentTest.value || !hasAnswer.value) return

    const t = currentTest.value as AnyRuleTest
    const type = t.type || 'multiple_choice'
    let isCorrect = false
    let distractorFeedback: string | undefined
    let userAnswerText = ''
    let expectedAnswerText = ''

    if (type === 'multiple_choice' || !t.type) {
      const mc = t as MultipleChoiceTest
      userAnswerText = selectedOption.value || ''
      expectedAnswerText = mc.correctAnswer
      isCorrect = userAnswerText.trim().toLowerCase() === expectedAnswerText.trim().toLowerCase()

      // Check if options have distractor feedback
      if (Array.isArray(mc.options)) {
        const matchingOpt = mc.options.find((opt) => {
          if (typeof opt === 'object' && opt !== null) {
            return (opt as MultipleChoiceOption).text === selectedOption.value
          }
          return false
        }) as MultipleChoiceOption | undefined

        if (matchingOpt && matchingOpt.feedback) {
          distractorFeedback = matchingOpt.feedback
        }
      }
    } else if (type === 'cloze_choice') {
      const cc = t as ClozeChoiceTest
      userAnswerText = selectedOption.value || ''
      expectedAnswerText = cc.correctAnswer
      isCorrect = userAnswerText.trim().toLowerCase() === expectedAnswerText.trim().toLowerCase()
    } else if (type === 'cloze_input') {
      const ci = t as ClozeInputTest
      userAnswerText = typedInput.value.trim()
      expectedAnswerText = ci.validAnswers[0] || ''
      const normalizedUser = userAnswerText.toLowerCase().replace(/['’]/g, "'")
      isCorrect = ci.validAnswers.some((ans) => {
        return ans.toLowerCase().replace(/['’]/g, "'") === normalizedUser
      })
    } else if (type === 'sentence_scramble') {
      const ss = t as SentenceScrambleTest
      userAnswerText = scrambleSelectedTokens.value.join(' ')
      expectedAnswerText = ss.correctOrder.join(' ')

      const userTokensJoined = scrambleSelectedTokens.value.join(' ').toLowerCase()
      const correctJoined = ss.correctOrder.join(' ').toLowerCase()
      if (userTokensJoined === correctJoined) {
        isCorrect = true
      } else if (ss.acceptableOrders) {
        isCorrect = ss.acceptableOrders.some(order => order.join(' ').toLowerCase() === userTokensJoined)
      }
    }

    if (isCorrect) {
      score.value++
    }

    completedCount.value++
    isSubmitted.value = true

    currentFeedback.value = {
      isCorrect,
      userAnswer: userAnswerText,
      correctAnswer: expectedAnswerText,
      explanation: t.explanation,
      distractorFeedback
    }

    options?.onResult?.(currentTest.value.ruleId, isCorrect, currentTest.value)
  }

  const nextQuestion = () => {
    currentTestIndex.value++
    initCurrentQuestion()
  }

  const restartTest = () => {
    currentTestIndex.value = 0
    score.value = 0
    completedCount.value = 0
    initCurrentQuestion()
  }

  return {
    currentTestIndex,
    currentTest,
    currentRule,
    isSubmitted,
    score,
    completedCount,
    hasAnswer,
    selectedOption,
    typedInput,
    scrambleAvailableTokens,
    scrambleSelectedTokens,
    currentFeedback,
    selectChoice,
    selectScrambleToken,
    removeScrambleToken,
    submitAnswer,
    nextQuestion,
    restartTest
  }
}
