export type TestType =
  | 'multiple_choice'   // Выбор 1 из N с объяснением дистракторов
  | 'cloze_choice'      // Выбор пропущенного слова из чипов
  | 'cloze_input'       // Ввод пропущенной формы с клавиатуры
  | 'sentence_scramble' // Сборка предложения из перемешанных слов
  | 'find_error'        // Поиск ошибки в сегментах предложения

export interface BaseTest {
  id: string
  ruleId: string
  type: TestType
  prompt?: string                // Инструкция к заданию
  explanation?: string          // Общее объяснение правила / решения
}

export interface MultipleChoiceOption {
  text: string
  isCorrect?: boolean
  feedback?: string             // Почему этот вариант верный/неверный (distractor explanation)
}

export interface MultipleChoiceTest extends BaseTest {
  type: 'multiple_choice'
  question: string
  options: string[] | MultipleChoiceOption[]
  correctAnswer: string
}

export interface ClozeChoiceTest extends BaseTest {
  type: 'cloze_choice'
  sentenceWithBlank: string     // "She ___ (go) to school every day."
  options: string[]
  correctAnswer: string
}

export interface ClozeInputTest extends BaseTest {
  type: 'cloze_input'
  sentenceWithBlank: string     // "She ___ (go) to school yesterday."
  validAnswers: string[]        // ["went"] (проверка регистронезависима)
  hints?: string[]
}

export interface SentenceScrambleTest extends BaseTest {
  type: 'sentence_scramble'
  translation: string           // "Она вчера пошла в библиотеку"
  tokens: string[]              // ["Yesterday", "she", "went", "to", "the", "library"]
  correctOrder: string[]
  acceptableOrders?: string[][] // Альтернативные правильные варианты порядка слов
}

export interface FindErrorSegment {
  text: string
  isError: boolean
  correction?: string
  explanation?: string
}

export interface FindErrorTest extends BaseTest {
  type: 'find_error'
  instruction?: string
  segments: FindErrorSegment[]
}

export type AnyRuleTest =
  | MultipleChoiceTest
  | ClozeChoiceTest
  | ClozeInputTest
  | SentenceScrambleTest
  | FindErrorTest

// Legacy interface compatibility
export interface LegacyRuleTest {
  id: string
  ruleId: string
  question: string
  options: string[]
  correctAnswer: string
  explanation?: string
  type?: TestType
}

export type RuleTest = AnyRuleTest | LegacyRuleTest

export interface TestResultFeedback {
  isCorrect: boolean
  userAnswer: string | string[]
  correctAnswer: string | string[]
  explanation?: string
  distractorFeedback?: string
}

export type GrammarMasteryLevel = 'new' | 'learning' | 'review' | 'mastered'

export interface GrammarSrsItem {
  ruleId: string
  lang: string
  mastery: GrammarMasteryLevel
  streak: number
  totalAttempts: number
  correctAttempts: number
  lastReviewedAt: string | null
  nextReviewAt: string | null
}
