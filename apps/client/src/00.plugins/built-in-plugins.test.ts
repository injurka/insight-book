import { describe, expect, it } from 'vitest'
import { builtInPlugins, isBuiltInPluginEnabled } from './built-in-plugins'

const chineseAnalyzer = builtInPlugins.find(plugin => plugin.id === 'chinese-analyzer')!
const russianAnalyzer = builtInPlugins.find(plugin => plugin.id === 'russian-analyzer')!

describe('built-in plugin defaults', () => {
  it.each([
    ['ru', true],
    ['en-US', true],
    ['zh', false],
    ['zh-CN', false],
  ])('uses the interface language %s for the Chinese analyzer', (appLanguage, expected) => {
    expect(isBuiltInPluginEnabled(chineseAnalyzer, {
      appLanguage,
      builtInPluginOverrides: {},
      legacyDisabledPlugins: [],
    })).toBe(expected)
  })

  it.each([
    ['zh', true],
    ['zh-CN', true],
    ['en-US', true],
    ['ru', false],
    ['ru-RU', false],
  ])('uses the interface language %s for the Russian analyzer', (appLanguage, expected) => {
    expect(isBuiltInPluginEnabled(russianAnalyzer, {
      appLanguage,
      builtInPluginOverrides: {},
      legacyDisabledPlugins: [],
    })).toBe(expected)
  })

  it.each([
    ['ru', false, []],
    ['zh', true, []],
    ['en', true, [chineseAnalyzer.id]],
  ])('honors a manual choice with interface language %s', (appLanguage, enabled, legacyDisabledPlugins) => {
    expect(isBuiltInPluginEnabled(chineseAnalyzer, {
      appLanguage,
      builtInPluginOverrides: { [chineseAnalyzer.id]: enabled },
      legacyDisabledPlugins,
    })).toBe(enabled)
  })

  it.each([
    ['zh', false, []],
    ['ru', true, []],
    ['en', true, [russianAnalyzer.id]],
  ])('honors a manual choice for Russian analyzer with interface language %s', (appLanguage, enabled, legacyDisabledPlugins) => {
    expect(isBuiltInPluginEnabled(russianAnalyzer, {
      appLanguage,
      builtInPluginOverrides: { [russianAnalyzer.id]: enabled },
      legacyDisabledPlugins,
    })).toBe(enabled)
  })

  it('preserves a disabled plugin from the old settings', () => {
    expect(isBuiltInPluginEnabled(chineseAnalyzer, {
      appLanguage: 'en',
      builtInPluginOverrides: {},
      legacyDisabledPlugins: [chineseAnalyzer.id],
    })).toBe(false)
  })
})
