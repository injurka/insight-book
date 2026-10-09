export interface SrsWord {
  id: number
  word: string
  translation: string
  language: string
  targetLanguage: string
  due: string
  reps: number
  state: number
}

export type LearningStage
  = | 'recognition'
    | 'meaning'
    | 'context'
    | 'recall'
    | 'production'

export interface CaseSuspect {
  id: string
  name: string
  role: string
  statement: string
}

export interface CaseClue {
  title: string
  description: string
  wordId: number
}

export interface WordChallenge {
  wordId: number
  recognitionLine: string
  contextSentence: string
  contextAnswer: string
  contextOptions: string[]
  recallPrompt: string
  recallAnswer: string
  acceptedRecallAnswers: string[]
  productionPrompt: string
  productionExample: string
  clueTitle: string
  clueDescription: string
}

export interface DetectiveCase {
  title: string
  opening: string
  suspects: CaseSuspect[]
  culpritId: string
  reveal: string
  challenges: WordChallenge[]
}

export interface ProductionEvaluation {
  accepted: boolean
  score: number
  feedback: string
  correctedAnswer: string
}
