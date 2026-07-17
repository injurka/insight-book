export interface RuleExample {
  sentence: string
  pinyin?: string
  translation: string
}

export interface Rule {
  id: string
  title: string
  pattern?: string // Формула правила, например: S + V + O
  hskLevel: 'hsk1' | 'hsk2' | 'hsk3' | 'hsk4' | 'hsk5' | 'hsk6' | 'none'
  category: 'grammar' | 'lexical' | 'collocation' | 'measure_words'
  tags: string[] // Подкатегории: 'sentence_structure', 'particles', etc.
  description: string
  examples: RuleExample[]
}

export interface RuleTest {
  id: string
  ruleId: string
  question: string
  options: string[]
  correctAnswer: string
  explanation?: string
}
