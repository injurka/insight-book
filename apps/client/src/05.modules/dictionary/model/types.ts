import type { UserDictItem, WordEncounter } from '~/01.shared/types/models'

export interface WordFormData extends Partial<UserDictItem> {
  contextSentence?: string
  contextBookId?: number
  encounters?: (WordEncounter & { book?: { title: string } })[]
}

export type QuizState = 'select_level' | 'loading' | 'testing' | 'summary'

export interface Question {
  type: 'choice' | 'cloze' | 'reorder'
  question: string
  options: string[]
  correctAnswer: string
  explanation: string
  userAnswer?: string
  isCorrect?: boolean
}

export interface LevelNode {
  id: number
  language: string
  levelValue: string
  bestScore: number
  stars: number
  unlocked: boolean
}
