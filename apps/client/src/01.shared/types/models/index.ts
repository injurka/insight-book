export interface AuthLoginDto {
  login?: string
  email?: string
  password?: string
  [key: string]: unknown
}

export interface AuthRegisterDto {
  email: string
  code: string
  password?: string
  [key: string]: unknown
}

export interface AuthSendCodeDto {
  email: string
}

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
  totalSentences?: number
  totalWords?: number
  posDistribution?: Record<string, number> | null
  topWords?: LexicalWordData[] | LexicalDataGroup | null
  lexicalDiversity?: number | null
}

export interface Book {
  id: number
  title: string
  author: string | null
  coverUrl: string | null
  localCoverUrl?: string
  filePath: string
  language: string
  totalPages: number
  currentPage: number | null
  createdAt: string
  updatedAt?: string
  userId?: number
  type?: string
  toc?: TocItem[]
  stats?: BookStats | null
  series?: string | null
  seriesNumber?: number | null
  status?: string
  isFavorite?: boolean
  collection?: string | null
  isPublic?: boolean
  publicStatus?: 'private' | 'pending' | 'public' | 'rejected'
  textDirection?: string | null
  progressUpdatedAt?: string | null
  analysesCount?: number
  cachedSentences?: number
  cachedWords?: number
  cachedTts?: number
  processStatus?: 'processing' | 'ready' | 'error'
  processError?: string | null
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
  localImageUrl?: string
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

export interface CatalogDeck {
  id: number
  name: string
  language: string
  targetLanguage: string
  wordCount: number
  description?: string
  author?: string
  difficulty?: string
}

export interface CatalogWord {
  id: number
  word: string
  translation?: string
  transcription?: string
}

export interface WordEncounter {
  id: number
  wordId: number
  bookId: number | null
  sentence: string
  createdAt: string
  bookTitle?: string
  book?: { title: string } | null
}

export interface UserDictItem {
  id: number
  deckIds: number[]
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

  // FSRS Fields
  state: number
  due: string
  stability: number
  difficultyFsrs: number
  scheduledDays: number
  reps: number
  lapses: number
  lastReview: string | null
  learningSteps: number

  createdAt: string
  updatedAt: string

  encounters?: WordEncounter[]
}

export interface LlmConfig {
  url: string
  key?: string
  model?: string
  fallbackModel?: string
  ttsModel?: string
  fallbackTtsModel?: string
  ttsUrl?: string
  ttsKey?: string
  sttModel?: string
  sttUrl?: string
  sttKey?: string
  ocrModel?: string
  ocrRefinementModel?: string
  ocrUrl?: string
  ocrKey?: string
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

export interface BatchAnalysisRequest {
  id: string
  sentence: string
  context?: string
  type?: 'sentence' | 'word'
}

export interface BatchAnalysisResponse {
  id: string
  analysis: LlmAnalysis
}

export interface SelectOption {
  label: string
  value: string | number
}

export interface UserData {
  id: number
  username: string
  email?: string | null
  yandexId?: string | null
  isYandexLinked?: boolean
  hasPassword?: boolean
  role?: string
  subscriptionTier?: 'free' | 'base' | 'advanced' | 'premium'
  usedTokens?: number
  tokenLimit?: number | null
  usedBooks?: number
  bookLimit?: number | null
  pushTargetDeckId?: number | null
  pushTimeStart?: string
  pushTimeEnd?: string
  pushCount?: number
  timezone?: string
  uiLanguage?: string
  avatarUrl?: string
}

export interface Highlight {
  id: number
  userId: number
  bookId: number
  text: string
  translation: string | null
  note: string | null
  color: string
  chapter: string | null
  pageNum: number
  analysisData?: LlmAnalysis | null
  createdAt: string
}

export interface PromptItem {
  id: number
  name: string
  prompt: string
  userId?: number
}

export interface UserPluginRecord {
  userId: number
  pluginId: string
  manifestUrl: string
  settings?: string | null
  isEnabled: boolean
  createdAt?: string
}

export interface CatalogPluginRecord {
  id: number
  name: string
  version: string
  description?: string | null
  icon?: string | null
  author?: string | null
  sourceUrl?: string | null
  manifestUrl: string
  status: 'pending' | 'approved' | 'rejected'
  uploadedBy: number
  createdAt: string
  updatedAt: string
}

/** Тариф подписки в локализованном виде (сервер отдаёт тексты на языке запроса). */
export interface SubscriptionTier {
  id: string
  icon: string
  badge: string
  name: string
  price: number
  dailyTokenLimit: number | null
  dailyBookLimit: number | null
  description: string
  features: string[]
  isPopular: boolean
  gradient: string
  accentColor: string
}
