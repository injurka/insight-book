export type SupportedLanguage = 'zh' | 'en' | 'ja' | 'es' | 'de' | 'fr' | 'ru'

export interface LanguageLevelMeta {
  id: string          // 'a1', 'b2', 'hsk1', 'n3'
  label: string       // 'A1 (Beginner)', 'HSK 1', 'JLPT N3'
  system: string      // 'cefr' | 'hsk' | 'jlpt' | 'custom'
  order: number
}

export interface LanguageCategoryMeta {
  id: string          // 'tenses', 'particles', 'measure_words', 'conditionals'
  titleKey: string    // Ключ локализации
  color?: string
}

export interface LanguageConfig {
  code: SupportedLanguage
  name: string
  phoneticType?: 'pinyin' | 'ipa' | 'furigana' | 'none'
  levels: LanguageLevelMeta[]
  categories: LanguageCategoryMeta[]
}

export interface RuleExample {
  sentence: string
  phonetic?: string   // Универсальное поле (Pinyin / IPA транскрипция / огласовки)
  pinyin?: string     // Обратная совместимость для китайского
  translation: string
  audioUrl?: string
  contextNotes?: string
}

export interface Rule {
  id: string
  lang?: SupportedLanguage
  title: string
  pattern?: string    // Формула правила, например: "S + V + O" или "Subject + have/has + V3"
  level: string       // 'a1', 'hsk1', 'n5' и т.д.
  hskLevel?: 'hsk1' | 'hsk2' | 'hsk3' | 'hsk4' | 'hsk5' | 'hsk6' | 'none' // Обратная совместимость
  category: string    // 'tenses', 'grammar', 'lexical', 'collocation', 'measure_words', 'modals'
  tags: string[]      // Подкатегории: 'sentence_structure', 'particles', 'aspect'
  description: string
  contrastWith?: string[] // С какими правилами часто путают (например, Past Simple vs Present Perfect)
  examples: RuleExample[]
}

export type GrammarRule = Rule
