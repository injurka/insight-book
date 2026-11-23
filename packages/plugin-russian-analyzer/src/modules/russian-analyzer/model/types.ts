export type InputLanguageCode = 'ru' | 'zh' | 'en'

export type RussianPosCode
  = | 'noun'
    | 'verb'
    | 'adj'
    | 'adv'
    | 'pron'
    | 'prep'
    | 'particle'
    | 'conj'
    | 'num'
    | 'participle'
    | 'other'

export type RussianCaseCode = 'nom' | 'gen' | 'dat' | 'acc' | 'ins' | 'loc' | 'none'

export type MorphemeType = 'prefix' | 'root' | 'suffix' | 'ending' | 'postfix'

export type MorphemeFeatureType = 'grammar' | 'cognate' | 'meaning'

export interface MorphemeFeatureNode {
  symbol: string
  label: string
  explanation: string
  type: MorphemeFeatureType
}

export interface MorphemeNode {
  text: string
  type: MorphemeType
  meaning: string
  roleInWord: string
  etymology?: string
  features: MorphemeFeatureNode[]
}

export interface CollocationExample {
  text: string
  stressedText: string
  translation: string
}

export interface RussianMorphologyMeta {
  caseCode: RussianCaseCode
  caseLabel?: string
  caseQuestion?: string
  gender?: string
  number?: string
  animacy?: string
  aspect?: string
  aspectPair?: string
  tense?: string
  person?: string
  mood?: string
}

export interface RussianLexemeToken {
  id: string
  word: string
  stressedWord: string
  lemma: string
  ipa: string
  sentenceIndex?: number
  trailingPunctuation?: string
  pos: RussianPosCode
  posLabel: string
  syntacticRole: string
  meaning: string
  dictionaryMeaning: string
  cefr: string
  grammarNote: string
  caseGovernmentNote?: string
  morphology: RussianMorphologyMeta
  collocations: CollocationExample[]
  morphemes: MorphemeNode[]
}

export interface SyntacticClause {
  id: string
  label: string
  role: string
  text: string
  translation: string
  tokenIds: string[]
}

export interface DependencyArc {
  id: string
  fromTokenId: string
  toTokenId: string
  relationLabel: string
}

export interface PhoneticRuleItem {
  title: string
  written: string
  spoken: string
  explanation: string
  sentenceIndex?: number
}

export interface WordStressSyllable {
  text: string
  stressed: boolean
  reduced: boolean
  phonetic?: string
}

export interface WordPhoneticCard {
  word: string
  stressedWord: string
  ipa: string
  syllables: WordStressSyllable[]
  reductionNote?: string
  isSentenceFocus?: boolean
}

export interface RussianPhoneticsAnalysis {
  intonationType: string
  intonationExplanation: string
  rhythmGrouping: string
  intonationNote: string
  phoneticRules: PhoneticRuleItem[]
  wordStressCards: WordPhoneticCard[]
}

export interface GrammarPatternItem {
  id: string
  name: string
  formula: string
  level: string
  explanation: string
  commonMistakes: string
  examples: CollocationExample[]
  sentenceIndex?: number
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
  text: string
  stressedText: string
  ipa: string
  translation: string
  register: string
  nuance: string
  sentenceIndex?: number
}

export interface RussianSentenceOverview {
  inputLanguage: InputLanguageCode
  originalInput: string
  plainText: string
  stressedText: string
  ipa: string
  translation: string
  literalTranslation: string
  cefrLevel: string
  register: string
  sentenceType: string
  structuralFormula: string
}

export interface RussianSentenceAnalysis {
  sentence: RussianSentenceOverview
  clauses: SyntacticClause[]
  tokens: RussianLexemeToken[]
  dependencies: DependencyArc[]
  phonetics: RussianPhoneticsAnalysis
  grammarPatterns: GrammarPatternItem[]
  usageContext: UsageContextInfo
  alternatives: AlternativeVariant[]
}

export type CanvasSelectedNode
  = | { kind: 'clause', clause: SyntacticClause }
    | { kind: 'token', token: RussianLexemeToken }
    | { kind: 'morpheme', token: RussianLexemeToken, morpheme: MorphemeNode, morphemeIndex: number }
    | { kind: 'feature', token: RussianLexemeToken, morpheme: MorphemeNode, feature: MorphemeFeatureNode }

export interface AnalysisHistoryItem {
  interfaceLanguage?: string
  id: string
  createdAt: number
  query: string
  plainText: string
  stressedText: string
  translation: string
  cefrLevel: string
  analysis: RussianSentenceAnalysis
}

export type CanvasViewMode = 'hierarchy' | 'linear'
