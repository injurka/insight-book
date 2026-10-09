export interface Word {
  id: number
  word: string
  translation: string
  language: string
  transcription: string
  due: string
}
export interface Mystery {
  introduction: string
  facts: string[]
  hints: [string, string, string]
}
export type Verdict = 'yes' | 'no' | 'partial' | 'unclear' | 'almost' | 'solved'
export type Direction = 'closer' | 'away' | 'neutral'
export interface Reply {
  verdict: Verdict
  direction: Direction
}
export interface Turn extends Reply {
  text: string
  kind: 'question' | 'guess'
}
export interface Round {
  word: Word
  mystery: Mystery
  turns: Turn[]
  hintsUsed: number
  outcome: 'playing' | 'solved' | 'revealed' | 'exhausted'
  grade: 'idle' | 'sending' | 'saved' | 'uncertain' | 'skipped'
}
export const MAX_TURNS = 20
export const VERDICTS: Record<Verdict, string> = {
  yes: 'Да',
  no: 'Нет',
  partial: 'Отчасти',
  unclear: 'Неясно',
  almost: 'Смысл верный',
  solved: 'Разгадано',
}
export const DIRECTIONS: Record<Direction, string> = {
  closer: 'Верный след',
  away: 'Другой путь',
  neutral: 'Продолжайте исследовать',
}
