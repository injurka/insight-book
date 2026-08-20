import type { LanguageConfig } from '~plugin-grammar-rules/shared/types'

export const enConfig: LanguageConfig = {
  code: 'en',
  name: 'English',
  phoneticType: 'ipa',
  levels: [
    { id: 'all', label: 'Все уровни', system: 'cefr', order: 0 },
    { id: 'a1', label: 'A1 (Beginner)', system: 'cefr', order: 1 },
    { id: 'a2', label: 'A2 (Elementary)', system: 'cefr', order: 2 },
    { id: 'b1', label: 'B1 (Intermediate)', system: 'cefr', order: 3 },
    { id: 'b2', label: 'B2 (Upper-Intermediate)', system: 'cefr', order: 4 },
    { id: 'c1', label: 'C1 (Advanced)', system: 'cefr', order: 5 },
  ],
  categories: [
    { id: 'all', titleKey: 'plugins.grammar-rules.catAll' },
    { id: 'tenses', titleKey: 'plugins.grammar-rules.catTenses', color: 'var(--fg-accent-color)' },
    { id: 'modals', titleKey: 'plugins.grammar-rules.catModals', color: 'var(--fg-info-color)' },
    { id: 'conditionals', titleKey: 'plugins.grammar-rules.catConditionals', color: 'var(--fg-warning-color)' },
    { id: 'passive', titleKey: 'plugins.grammar-rules.catPassive', color: 'var(--fg-error-color)' },
    { id: 'articles', titleKey: 'plugins.grammar-rules.catArticles', color: 'var(--fg-success-color)' },
  ],
}
