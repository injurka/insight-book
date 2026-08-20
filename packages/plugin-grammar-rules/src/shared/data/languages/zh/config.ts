import type { LanguageConfig } from '../../../types'

export const zhConfig: LanguageConfig = {
  code: 'zh',
  name: 'Chinese (中文)',
  phoneticType: 'pinyin',
  levels: [
    { id: 'all', label: 'Все уровни', system: 'hsk', order: 0 },
    { id: 'hsk1', label: 'HSK 1', system: 'hsk', order: 1 },
    { id: 'hsk2', label: 'HSK 2', system: 'hsk', order: 2 },
    { id: 'hsk3', label: 'HSK 3', system: 'hsk', order: 3 },
    { id: 'hsk4', label: 'HSK 4', system: 'hsk', order: 4 },
    { id: 'hsk5', label: 'HSK 5', system: 'hsk', order: 5 },
    { id: 'hsk6', label: 'HSK 6', system: 'hsk', order: 6 },
  ],
  categories: [
    { id: 'all', titleKey: 'plugins.grammar-rules.catAll' },
    { id: 'grammar', titleKey: 'plugins.grammar-rules.catGrammar', color: 'var(--fg-accent-color)' },
    { id: 'lexical', titleKey: 'plugins.grammar-rules.catLexical', color: 'var(--fg-success-color)' },
    { id: 'collocation', titleKey: 'plugins.grammar-rules.catCollocation', color: 'var(--fg-error-color)' },
    { id: 'measure_words', titleKey: 'plugins.grammar-rules.catMeasureWords', color: 'var(--fg-warning-color)' },
  ],
}
