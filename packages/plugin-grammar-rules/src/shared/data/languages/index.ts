import type { LanguageConfig, Rule, RuleTest, SupportedLanguage } from '../../types'
import { enConfig } from './en/config'
import enRulesData from './en/rules.json'
import enTestsData from './en/tests.json'
import { zhConfig } from './zh/config'
import hsk1Rules from '../hsk1-rules.json'
import hsk1Tests from '../hsk1-tests.json'
import hsk2Rules from '../hsk2-rules.json'
import hsk2Tests from '../hsk2-tests.json'

const zhRulesNormalized: Rule[] = ([...hsk1Rules, ...hsk2Rules] as Array<Record<string, unknown>>).map((r) => {
  return {
    id: String(r.id),
    lang: 'zh',
    title: String(r.title),
    pattern: r.pattern ? String(r.pattern) : undefined,
    level: String(r.hskLevel || 'hsk1'),
    hskLevel: r.hskLevel as Rule['hskLevel'],
    category: String(r.category || 'grammar'),
    tags: Array.isArray(r.tags) ? r.tags.map(String) : [],
    description: String(r.description || ''),
    examples: Array.isArray(r.examples)
      ? (r.examples as Array<Record<string, unknown>>).map(ex => ({
          sentence: String(ex.sentence || ''),
          phonetic: ex.pinyin ? String(ex.pinyin) : undefined,
          pinyin: ex.pinyin ? String(ex.pinyin) : undefined,
          translation: String(ex.translation || ''),
        }))
      : [],
  }
})

const zhTestsNormalized: RuleTest[] = ([...hsk1Tests, ...hsk2Tests] as Array<Record<string, unknown>>).map((t) => {
  return {
    id: String(t.id),
    ruleId: String(t.ruleId),
    type: 'multiple_choice',
    question: String(t.question),
    options: Array.isArray(t.options) ? t.options.map(String) : [],
    correctAnswer: String(t.correctAnswer),
    explanation: t.explanation ? String(t.explanation) : undefined,
  }
})

const enRulesNormalized: Rule[] = (enRulesData as Array<Record<string, unknown>>).map((r) => {
  return {
    id: String(r.id),
    lang: 'en',
    title: String(r.title),
    pattern: r.pattern ? String(r.pattern) : undefined,
    level: String(r.level || 'a1'),
    category: String(r.category || 'tenses'),
    tags: Array.isArray(r.tags) ? r.tags.map(String) : [],
    description: String(r.description || ''),
    contrastWith: Array.isArray(r.contrastWith) ? r.contrastWith.map(String) : undefined,
    examples: Array.isArray(r.examples)
      ? (r.examples as Array<Record<string, unknown>>).map(ex => ({
          sentence: String(ex.sentence || ''),
          phonetic: ex.phonetic ? String(ex.phonetic) : undefined,
          translation: String(ex.translation || ''),
        }))
      : [],
  }
})

const enTestsNormalized: RuleTest[] = enTestsData as unknown as RuleTest[]

export const LANGUAGE_CONFIGS: Record<SupportedLanguage, LanguageConfig> = {
  zh: zhConfig,
  en: enConfig,
  ja: {
    code: 'ja',
    name: 'Japanese (日本語)',
    phoneticType: 'furigana',
    levels: [
      { id: 'all', label: 'Все уровни', system: 'jlpt', order: 0 },
      { id: 'n5', label: 'JLPT N5', system: 'jlpt', order: 1 },
      { id: 'n4', label: 'JLPT N4', system: 'jlpt', order: 2 },
      { id: 'n3', label: 'JLPT N3', system: 'jlpt', order: 3 },
    ],
    categories: [
      { id: 'all', titleKey: 'plugins.grammar-rules.catAll' },
      { id: 'particles', titleKey: 'plugins.grammar-rules.catParticles' },
      { id: 'grammar', titleKey: 'plugins.grammar-rules.catGrammar' },
    ],
  },
  es: {
    code: 'es',
    name: 'Spanish (Español)',
    levels: [
      { id: 'all', label: 'Все уровни', system: 'cefr', order: 0 },
      { id: 'a1', label: 'A1', system: 'cefr', order: 1 },
      { id: 'a2', label: 'A2', system: 'cefr', order: 2 },
    ],
    categories: [{ id: 'all', titleKey: 'plugins.grammar-rules.catAll' }],
  },
  de: {
    code: 'de',
    name: 'German (Deutsch)',
    levels: [
      { id: 'all', label: 'Все уровни', system: 'cefr', order: 0 },
      { id: 'a1', label: 'A1', system: 'cefr', order: 1 },
      { id: 'a2', label: 'A2', system: 'cefr', order: 2 },
    ],
    categories: [{ id: 'all', titleKey: 'plugins.grammar-rules.catAll' }],
  },
  fr: {
    code: 'fr',
    name: 'French (Français)',
    levels: [
      { id: 'all', label: 'Все уровни', system: 'cefr', order: 0 },
      { id: 'a1', label: 'A1', system: 'cefr', order: 1 },
    ],
    categories: [{ id: 'all', titleKey: 'plugins.grammar-rules.catAll' }],
  },
  ru: {
    code: 'ru',
    name: 'Russian (Русский)',
    levels: [{ id: 'all', label: 'Все уровни', system: 'cefr', order: 0 }],
    categories: [{ id: 'all', titleKey: 'plugins.grammar-rules.catAll' }],
  },
}

export function getAvailableLanguages(): Array<{ code: SupportedLanguage, name: string }> {
  return [
    { code: 'en', name: 'English' },
    { code: 'zh', name: 'Chinese (中文)' },
  ]
}

export function getLanguageConfig(lang: SupportedLanguage): LanguageConfig {
  return LANGUAGE_CONFIGS[lang] || enConfig
}

export function loadLanguageRules(lang: SupportedLanguage): Rule[] {
  if (lang === 'zh')
    return zhRulesNormalized
  if (lang === 'en')
    return enRulesNormalized
  return []
}

export function loadLanguageTests(lang: SupportedLanguage): RuleTest[] {
  if (lang === 'zh')
    return zhTestsNormalized
  if (lang === 'en')
    return enTestsNormalized
  return []
}
