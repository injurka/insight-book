import type { Book } from '~/01.shared/types/models'

export interface DisplayGroup {
  seriesName: string
  isFolderContent?: boolean
  icon?: string
  books?: Book[]
  folders?: { name: string, count: number }[]
}

export interface SyncProgressNotificationOptions {
  title: string
  formatProgress: (progress: SyncNotificationProgress) => string
}

export type SyncNotificationPhase = 'preparing' | 'serverCache' | 'cover' | 'pages' | 'sentences' | 'words' | 'audio'

export interface SyncNotificationSelection {
  analyzeSentences: boolean
  analyzeWords: boolean
  ttsSentences: boolean
  ttsWords: boolean
}

export interface SyncNotificationProgress {
  phase: SyncNotificationPhase
  currentPage: number
  pagesDone: number
  pagesTotal: number
  sentencesDone: number
  sentencesFromCache: number
  wordsDone: number
  wordsFromCache: number
  ttsDone: number
  ttsFromCache: number
}
