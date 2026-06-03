export interface OcrBlock {
  id: number
  text: string
  html?: string
  x: number
  y: number
  w: number
  h: number
}

export interface BookStats {
  bookId: number
  description: string
  difficulty: string
  tags: string[]
  totalChars: number
  uniqueChars: number
  posDistribution?: Record<string, number> | null
  topWords?: Array<{ word: string, pos: string, count: number }> | null
  lexicalDiversity?: number | null
}

export interface Book {
  id: number
  userId: number
  title: string
  type: 'epub' | 'manga' | 'fb2'
  author: string | null
  coverUrl: string | null
  filePath: string
  language: string
  totalPages: number
  currentPage: number | null
  createdAt: string
  updatedAt: string
  toc?: TocItem[]
  stats?: BookStats | null
  series?: string | null
  seriesNumber?: number | null
  status?: string
  isFavorite?: boolean
  isPublic?: boolean
  collection?: string | null
  progressUpdatedAt?: string | null
}

export interface TocItem {
  id: string
  href: string
  title: string
  order: number
  level: number
  pageNum?: number
}

export interface TokenizedWord {
  word: string
  pos: string
}

export interface TokenizedSentence {
  sentenceId: number
  tokens: TokenizedWord[]
  raw: string
}

export interface PageDictEntry {
  transcription: string
  translation: string
  isUserDict?: boolean
}

export interface PagePayload {
  bookId: number
  pageNum: number
  totalPages: number
  type?: 'epub' | 'manga' | 'fb2'
  content: string
  pageDictionary: Record<string, PageDictEntry>
  imageUrl?: string
  imageWidth?: number
  imageHeight?: number
  ocrBlocks?: OcrBlock[]
}

export interface GrammarRule {
  pattern: string
  explanation: string
  example: string
}

export interface VocabItem {
  word: string
  transcription: string
  meaning: string
  usageInContext: string
}

export interface LlmAnalysis {
  transcription: string
  translation: string
  grammarRules: GrammarRule[]
  vocabulary: VocabItem[]
}

export interface DictDeck {
  id: number
  userId: number
  name: string
  language: string
  createdAt: string
}

export interface WordEncounter {
  id: number
  wordId: number
  bookId: number | null
  sentence: string
  createdAt: string
  bookTitle?: string
}

export interface UserDictItem {
  id: number
  deckId: number | null
  word: string
  transcription: string | null
  translation: string | null
  language: string
  notes: string | null
  tags: string | null
  difficulty: string | null

  status: number
  repetitions: number
  interval: number
  easeFactor: number
  nextReviewDate: string

  createdAt: string
  updatedAt: string

  encounters?: WordEncounter[]
}

export interface WordExample {
  type: string
  original: string
  transcription: string
  translation: string
  literal_translation: string
}

export interface WordCollocation {
  original: string
  transcription: string
  translation: string
}

export interface WordRelationItem {
  word: string
  transcription: string
  translation: string
}

export interface WordRelations {
  synonyms?: WordRelationItem[]
  antonyms?: WordRelationItem[]
}

export interface GeneratedWordExamples {
  word: string
  transcription: string
  main_translations: string[]
  mnemonics?: string
  grammar_note?: string
  examples?: WordExample[]
  collocations?: WordCollocation[]
  relations?: WordRelations
}

export interface OpdsCatalog {
  id: number
  userId: number
  title: string
  url: string
  createdAt: string
}

export interface OpdsLink {
  rel: string
  href: string
  type: string
  title?: string
}

export interface OpdsEntry {
  title: string
  author: string
  content: string
  links: OpdsLink[]
}

export interface OpdsFeed {
  title: string
  links: OpdsLink[]
  entries: OpdsEntry[]
}
