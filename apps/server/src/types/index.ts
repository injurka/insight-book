export type { ModelMessage } from 'ai'

export interface LexicalWordData {
  word: string
  pos: string
  count: number
}

export interface LexicalDataGroup {
  nouns: LexicalWordData[]
  verbs: LexicalWordData[]
  adjs: LexicalWordData[]
  properNouns: LexicalWordData[]
  rareWords: LexicalWordData[]
}

export interface BookStats {
  bookId: number
  description: string
  difficulty: string
  tags: string[]
  totalChars: number
  uniqueChars: number
  posDistribution?: Record<string, number> | null
  topWords?: LexicalWordData[] | LexicalDataGroup | null
  lexicalDiversity?: number | null
}

export interface Book {
  id: number
  title: string
  author: string | null
  coverUrl: string | null
  filePath: string
  language: string
  totalPages: number
  currentPage: number | null
  createdAt: string
  toc?: TocItem[]
  stats?: BookStats | null
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

export interface OcrBlock {
  id: number
  text: string
  html?: string
  x: number
  y: number
  w: number
  h: number
}

export interface PagePayload {
  bookId: number
  pageNum: number
  totalPages: number
  content: string
  pageDictionary?: Record<string, PageDictEntry>
  type?: 'epub' | 'manga'
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
  targetLanguage: string
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
  targetLanguage: string
  notes: string | null
  tags: string | null
  difficulty: string | null
  grammarNote: string | null
  vocabularyNote: string | null

  status: number
  repetitions: number
  interval: number
  easeFactor: number
  nextReviewDate: string

  createdAt: string
  updatedAt: string

  encounters?: WordEncounter[]
}

export interface LlmConfig {
  url: string
  key?: string
  // Флаг для агрегаторов (OpenRouter, AiHubMix и т.д.)
  isAggregator?: boolean
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
  vocabulary?: VocabItem[]
  mnemonics?: string
  grammar_note?: string
  examples?: WordExample[]
  collocations?: WordCollocation[]
  relations?: WordRelations
}

export interface WordAutoFillResponse {
  transcription: string
  translation: string
  difficulty: string
  tags: string
  grammarNote: string
  vocabularyNote: string
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
