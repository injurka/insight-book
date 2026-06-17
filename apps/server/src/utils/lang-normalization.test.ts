import { describe, expect, test } from 'bun:test'
import { getLangName, getSystemPrompt } from '../prompts'
import { normalizeLanguageCode } from './helpers'

describe('Language Code Normalization', () => {
  test('normalizes weighted Accept-Language strings correctly', () => {
    expect(normalizeLanguageCode('zh-CN,zh;q=0.9')).toBe('zh')
    expect(normalizeLanguageCode('ru-RU,ru;q=0.8')).toBe('ru')
    expect(normalizeLanguageCode('ja-JP')).toBe('ja')
    expect(normalizeLanguageCode('en-US;q=0.7')).toBe('en')
  })

  test('returns appropriate defaults for empty, null, or undefined values', () => {
    expect(normalizeLanguageCode(undefined)).toBe('')
    expect(normalizeLanguageCode(null)).toBe('')
    expect(normalizeLanguageCode('')).toBe('')
  })

  test('handles case sensitivity and extra whitespace robustly', () => {
    expect(normalizeLanguageCode('  ZH-cn,zh;q=0.9  ')).toBe('zh')
    expect(normalizeLanguageCode('RU-ru;Q=0.8')).toBe('ru')
    expect(normalizeLanguageCode('   ')).toBe('')
  })

  test('handles invalid or malformed strings gracefully', () => {
    expect(normalizeLanguageCode('12345')).toBe('12345')
    expect(normalizeLanguageCode('/;@#')).toBe('/')
  })
})

describe('getLangName Mapping', () => {
  test('maps normalized language codes to their full English names', () => {
    expect(getLangName('zh')).toBe('Chinese')
    expect(getLangName('ru')).toBe('Russian')
    expect(getLangName('ja')).toBe('Japanese')
    expect(getLangName('en')).toBe('English')
  })

  test('maps weighted Accept-Language strings correctly via getLangName', () => {
    expect(getLangName('zh-CN,zh;q=0.9')).toBe('Chinese')
    expect(getLangName('ru-RU,ru;q=0.8')).toBe('Russian')
    expect(getLangName('ja-JP')).toBe('Japanese')
    expect(getLangName('en-US;q=0.7')).toBe('English')
  })

  test('falls back to Foreign for empty or undefined values', () => {
    expect(getLangName(undefined)).toBe('Foreign')
    expect(getLangName('')).toBe('Foreign')
  })

  test('falls back to uppercase code for unknown target languages', () => {
    expect(getLangName('fr')).toBe('FR')
    expect(getLangName('es')).toBe('ES')
    expect(getLangName('es-ES')).toBe('ES')
    expect(getLangName('12345')).toBe('12345')
  })
})

describe('getSystemPrompt Dynamic Patterns', () => {
  test('embeds source-language specific pattern in the output schema instructions', () => {
    // Japanese
    const jaPrompt = getSystemPrompt('ja', 'en')
    expect(jaPrompt).toContain('V + て + もいい')
    expect(jaPrompt).not.toContain('Subject + 正在 + Verb')

    // Chinese
    const zhPrompt = getSystemPrompt('zh', 'en')
    expect(zhPrompt).toContain('Subject + 正在 + Verb')
    expect(zhPrompt).not.toContain('V + て + もいい')

    // Russian
    const ruPrompt = getSystemPrompt('ru', 'en')
    expect(ruPrompt).toContain('Verb + бы')

    // English
    const enPrompt = getSystemPrompt('en', 'ru')
    expect(enPrompt).toContain('Subject + have + V-ed')

    // Fallback for unknown language (e.g. French)
    const frPrompt = getSystemPrompt('fr', 'en')
    expect(frPrompt).toContain('V + ...')
  })

  test('handles weighted Accept-Language strings for prompts normalization', () => {
    const jaPrompt = getSystemPrompt('ja-JP', 'en-US;q=0.7')
    expect(jaPrompt).toContain('Japanese')
    expect(jaPrompt).toContain('English')
    expect(jaPrompt).toContain('V + て + もいい')

    const zhPrompt = getSystemPrompt('zh-CN,zh;q=0.9', 'ru-RU,ru;q=0.8')
    expect(zhPrompt).toContain('Chinese')
    expect(zhPrompt).toContain('Russian')
    expect(zhPrompt).toContain('Subject + 正在 + Verb')
  })

  test('uses the code name fallback cleanly in getSystemPrompt without conflict', () => {
    const prompt = getSystemPrompt('fr', 'es')
    expect(prompt).toContain('FR')
    expect(prompt).toContain('ES')
    expect(prompt).toContain('STRICTLY IN ES AND NOT IN FR')
    expect(prompt).not.toContain('STRICTLY IN Foreign AND NOT IN Foreign')
  })
})
