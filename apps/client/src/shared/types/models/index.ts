export interface BookStats {
  bookId: number
  description: string
  difficulty: string
  tags: string[]
  totalChars: number
  uniqueChars: number
}

export interface Book {
  id: number
  title: string
  author: string | null
  coverBase64: string | null
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
  pinyin: string
  translation: string
}

export interface PagePayload {
  bookId: number
  pageNum: number
  totalPages: number
  content: TokenizedSentence[]
  pageDictionary: Record<string, PageDictEntry>
}

export interface GrammarRule {
  pattern: string
  explanation: string
  example: string
}

export interface VocabItem {
  word: string
  pinyin: string
  meaning: string
  usageInContext: string
}

export interface GeminiAnalysis {
  translation: string
  grammarRules: GrammarRule[]
  vocabulary: VocabItem[]
}

export interface UserDictItem {
  id: number
  word: string
  pinyin: string
  translation: string
  notes: string | null
  tags: string | null
  createdAt: string
  updatedAt: string
}
