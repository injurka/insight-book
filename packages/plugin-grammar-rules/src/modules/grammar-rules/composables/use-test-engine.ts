import type { Ref } from 'vue'
import type {
  AnyRuleTest,
  ClozeChoiceTest,
  ClozeInputTest,
  MultipleChoiceOption,
  MultipleChoiceTest,
  Rule,
  RuleTest,
  SentenceScrambleTest,
  TestResultFeedback,
} from '../../../shared/types'
import { computed, ref, watch } from 'vue'

export interface TestEngineOptions {
  onResult?: (ruleId: string, isCorrect: boolean, test: RuleTest) => void
}

interface AnswerEvaluation {
  isCorrect: boolean
  userAnswerText: string
  expectedAnswerText: string
  distractorFeedback?: string
}

function getDistractorFeedback(test: MultipleChoiceTest, selectedOption: string | null): string | undefined {
  if (!Array.isArray(test.options)) {
    return undefined
  }

  const matchingOption = test.options.find((option) => {
    return typeof option === 'object'
      && option !== null
      && (option as MultipleChoiceOption).text === selectedOption
  }) as MultipleChoiceOption | undefined

  return matchingOption?.feedback
}

function matchesAnswer(userAnswer: string, expectedAnswer: string): boolean {
  return userAnswer.trim().toLowerCase() === expectedAnswer.trim().toLowerCase()
}

function evaluateMultipleChoice(test: MultipleChoiceTest, selectedOption: string | null): AnswerEvaluation {
  const userAnswerText = selectedOption || ''

  return {
    isCorrect: matchesAnswer(userAnswerText, test.correctAnswer),
    userAnswerText,
    expectedAnswerText: test.correctAnswer,
    distractorFeedback: getDistractorFeedback(test, selectedOption),
  }
}

function evaluateClozeChoice(test: ClozeChoiceTest, selectedOption: string | null): AnswerEvaluation {
  const userAnswerText = selectedOption || ''

  return {
    isCorrect: matchesAnswer(userAnswerText, test.correctAnswer),
    userAnswerText,
    expectedAnswerText: test.correctAnswer,
  }
}

function evaluateClozeInput(test: ClozeInputTest, typedInput: string): AnswerEvaluation {
  const userAnswerText = typedInput.trim()
  const expectedAnswerText = test.validAnswers[0] || ''
  const normalizedUser = userAnswerText.toLowerCase().replace(/['’]/g, '\'')

  return {
    isCorrect: test.validAnswers.some(answer => answer.toLowerCase().replace(/['’]/g, '\'') === normalizedUser),
    userAnswerText,
    expectedAnswerText,
  }
}

function evaluateSentenceScramble(test: SentenceScrambleTest, selectedTokens: string[]): AnswerEvaluation {
  const userAnswerText = selectedTokens.join(' ')
  const expectedAnswerText = test.correctOrder.join(' ')
  const normalizedUser = userAnswerText.toLowerCase()
  const isCorrect = normalizedUser === expectedAnswerText.toLowerCase()
    || Boolean(test.acceptableOrders?.some(order => order.join(' ').toLowerCase() === normalizedUser))

  return { isCorrect, userAnswerText, expectedAnswerText }
}

function evaluateAnswer(
  test: AnyRuleTest,
  selectedOption: string | null,
  typedInput: string,
  selectedTokens: string[],
): AnswerEvaluation {
  switch (test.type || 'multiple_choice') {
    case 'multiple_choice':
      return evaluateMultipleChoice(test as MultipleChoiceTest, selectedOption)
    case 'cloze_choice':
      return evaluateClozeChoice(test as ClozeChoiceTest, selectedOption)
    case 'cloze_input':
      return evaluateClozeInput(test as ClozeInputTest, typedInput)
    case 'sentence_scramble':
      return evaluateSentenceScramble(test as SentenceScrambleTest, selectedTokens)
    default:
      return { isCorrect: false, userAnswerText: '', expectedAnswerText: '' }
  }
}

export function useTestEngine(tests: Ref<RuleTest[]>, rules: Ref<Rule[]>, options?: TestEngineOptions) {
  const sessionTests = ref<RuleTest[]>([])
  const currentTestIndex = ref(0)
  const isSubmitted = ref(false)
  const isRoundComplete = ref(false)
  const score = ref(0)
  const completedCount = ref(0)

  // State for different question types
  const selectedOption = ref<string | null>(null)
  const typedInput = ref('')
  const scrambleAvailableTokens = ref<string[]>([])
  const scrambleSelectedTokens = ref<string[]>([])
  const currentFeedback = ref<TestResultFeedback | null>(null)

  const currentTest = computed<RuleTest | null>(() => {
    if (!sessionTests.value || sessionTests.value.length === 0)
      return null

    if (currentTestIndex.value >= sessionTests.value.length)
      return null

    return sessionTests.value[currentTestIndex.value]
  })

  const currentRule = computed<Rule | null>(() => {
    if (!currentTest.value)
      return null

    return rules.value.find(r => r.id === currentTest.value!.ruleId) || null
  })

  // Initialize test state on question change
  const initCurrentQuestion = () => {
    selectedOption.value = null
    typedInput.value = ''
    scrambleSelectedTokens.value = []
    currentFeedback.value = null
    isSubmitted.value = false

    if (!currentTest.value)
      return

    const t = currentTest.value as AnyRuleTest

    if (t.type === 'sentence_scramble') {
      const scrambleTest = t as SentenceScrambleTest
      // Shuffle tokens for scramble pool
      scrambleAvailableTokens.value = [...scrambleTest.tokens].sort(() => Math.random() - 0.5)
    }
  }

  const initSession = (newTests?: RuleTest[]) => {
    sessionTests.value = newTests ? [...newTests] : [...tests.value]
    currentTestIndex.value = 0
    score.value = 0
    completedCount.value = 0
    isRoundComplete.value = false
    initCurrentQuestion()
  }

  watch(tests, (newTests) => {
    if (!isSubmitted.value && (sessionTests.value.length === 0 || currentTestIndex.value === 0)) {
      sessionTests.value = [...newTests]
      initCurrentQuestion()
    }
  }, { immediate: true })

  // Multiple Choice / Cloze Choice action
  const selectChoice = (opt: string) => {
    if (isSubmitted.value)
      return

    selectedOption.value = opt
  }

  // Sentence Scramble actions
  const selectScrambleToken = (tokenIndex: number) => {
    if (isSubmitted.value)
      return

    const token = scrambleAvailableTokens.value[tokenIndex]
    scrambleAvailableTokens.value.splice(tokenIndex, 1)
    scrambleSelectedTokens.value.push(token)
  }

  const removeScrambleToken = (tokenIndex: number) => {
    if (isSubmitted.value)
      return

    const token = scrambleSelectedTokens.value[tokenIndex]
    scrambleSelectedTokens.value.splice(tokenIndex, 1)
    scrambleAvailableTokens.value.push(token)
  }

  const hasAnswer = computed(() => {
    if (!currentTest.value)
      return false

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
    if (isSubmitted.value || !currentTest.value || !hasAnswer.value)
      return

    const test = currentTest.value as AnyRuleTest
    const evaluation = evaluateAnswer(
      test,
      selectedOption.value,
      typedInput.value,
      scrambleSelectedTokens.value,
    )

    if (evaluation.isCorrect) {
      score.value++
    }

    completedCount.value++
    isSubmitted.value = true

    currentFeedback.value = {
      isCorrect: evaluation.isCorrect,
      userAnswer: evaluation.userAnswerText,
      correctAnswer: evaluation.expectedAnswerText,
      explanation: test.explanation,
      distractorFeedback: evaluation.distractorFeedback,
    }

    options?.onResult?.(test.ruleId, evaluation.isCorrect, currentTest.value)
  }

  const nextQuestion = () => {
    if (currentTestIndex.value + 1 >= sessionTests.value.length) {
      isRoundComplete.value = true
    }
    else {
      currentTestIndex.value++
      initCurrentQuestion()
    }
  }

  const restartTest = (customTests?: RuleTest[]) => {
    initSession(customTests)
  }

  return {
    sessionTests,
    currentTestIndex,
    currentTest,
    currentRule,
    isSubmitted,
    isRoundComplete,
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
    restartTest,
  }
}
