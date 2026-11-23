export type ComponentRoleType = 'semantic' | 'phonetic' | 'radical'

export type ToneNumber = 1 | 2 | 3 | 4 | 5

export type PartOfSpeechCode
  = | 'noun'
    | 'verb'
    | 'adj'
    | 'adv'
    | 'pron'
    | 'prep'
    | 'particle'
    | 'measure'
    | 'conj'
    | 'idiom'
    | 'num'
    | 'other'

export interface ComponentNode {
  symbol: string
  name: string
  meaning: string
  type: ComponentRoleType
}

export interface CharacterNode {
  char: string
  pinyin: string
  tone: ToneNumber
  meaning: string
  roleInWord: string
  etymology: string
  structureType?: string
  components: ComponentNode[]
}

export interface CollocationExample {
  hanzi: string
  pinyin: string
  translation: string
}

export interface LexemeToken {
  id: string
  hanzi: string
  pinyin: string
  tones: ToneNumber[]
  toneSandhiNote?: string
  sentenceIndex?: number
  trailingPunctuation?: string
  pos: PartOfSpeechCode
  posLabel: string
  syntacticRole: string
  meaning: string
  dictionaryMeaning: string
  hsk: string
  grammarNote: string
  collocations: CollocationExample[]
  characters: CharacterNode[]
}

export interface SyntacticClause {
  id: string
  label: string
  role: string
  hanzi: string
  translation: string
  tokenIds: string[]
}

export interface DependencyArc {
  id: string
  fromTokenId: string
  toTokenId: string
  relationLabel: string
}

export interface ToneSandhiRuleItem {
  /** Предложение, к которому относится правило. `undefined` — относится ко всему тексту. */
  sentenceIndex?: number
  title: string
  before: string
  after: string
  explanation: string
}

export interface SyllableTonePoint {
  hanzi: string
  pinyin: string
  baseTone: ToneNumber
  spokenTone: ToneNumber
  sandhiApplied: boolean
  note?: string
}

export interface PhoneticsAnalysis {
  rhythmGrouping: string
  intonationNote: string
  sandhiRules: ToneSandhiRuleItem[]
  syllables: SyllableTonePoint[]
}

export interface GrammarPatternItem {
  /** Предложение, к которому относится конструкция. `undefined` — относится ко всему тексту. */
  sentenceIndex?: number
  id: string
  name: string
  formula: string
  level: string
  explanation: string
  commonMistakes: string
  examples: CollocationExample[]
}

export interface UsageContextInfo {
  whenToUse: string
  formalityScore: number
  formalityLabel: string
  emotionalNuance: string
  culturalNote: string
  typicalContexts: string[]
}

export interface AlternativeVariant {
  /** Предложение, для которого сделан вариант. `undefined` — относится ко всему тексту. */
  sentenceIndex?: number
  hanzi: string
  pinyin: string
  translation: string
  register: string
  nuance: string
}

export interface SentenceOverview {
  inputLanguage: 'zh' | 'ru'
  originalInput: string
  hanzi: string
  pinyin: string
  translation: string
  literalTranslation: string
  hskLevel: string
  register: string
  sentenceType: string
  structuralFormula: string
}

export interface ChineseSentenceAnalysis {
  sentence: SentenceOverview
  clauses: SyntacticClause[]
  tokens: LexemeToken[]
  dependencies: DependencyArc[]
  phonetics: PhoneticsAnalysis
  grammarPatterns: GrammarPatternItem[]
  usageContext: UsageContextInfo
  alternatives: AlternativeVariant[]
}

export type CanvasSelectedNode
  = | { kind: 'clause', clause: SyntacticClause }
    | { kind: 'token', token: LexemeToken }
    | { kind: 'character', token: LexemeToken, character: CharacterNode, charIndex: number }
    | { kind: 'component', token: LexemeToken, character: CharacterNode, component: ComponentNode }

export interface AnalysisHistoryItem {
  id: string
  createdAt: number
  query: string
  hanzi: string
  pinyin: string
  translation: string
  hskLevel: string
  analysis: ChineseSentenceAnalysis
}

export type CanvasViewMode = 'hierarchy' | 'linear'
