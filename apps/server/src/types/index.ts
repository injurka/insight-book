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
  pageDictionary: Record<string, PageDictEntry>
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

export interface UserDictItem {
  id: number
  word: string
  transcription: string | null
  translation: string | null
  language: string
  notes: string | null
  tags: string | null
  createdAt: string
  updatedAt: string
}
