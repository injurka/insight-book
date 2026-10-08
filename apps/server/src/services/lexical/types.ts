import type { TokenizedWord } from '../../types'

export interface ProfileToken extends TokenizedWord {
  lemma?: string
  entity?: boolean
  nameCandidate?: boolean
}

export interface WordEvidence {
  word: string
  pos: string
  posCounts: Map<string, number>
  count: number
  pages: Set<number>
  capitalized: number
  entity: number
  forms: Map<string, number>
}
