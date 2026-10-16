import type { WordAutoFillResponse } from '../../types'

export interface BookDeckWord {
  word: string
  count: number
  forms: string[]
  properName: boolean
  contexts: { sentence: string, page: number }[]
  source: 'dictionary' | 'cache' | 'missing' | 'generated'
  dictionaryId?: number
  content: WordAutoFillResponse | null
}

export interface BookDeckDraft {
  id: string
  bookId: number
  name: string
  language: string
  targetLanguage: string
  words: BookDeckWord[]
  deckId: number | null
}
