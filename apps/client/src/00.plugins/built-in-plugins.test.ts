import { describe, expect, it } from 'vitest'
import { builtInPlugins, isBuiltInPluginEnabled } from './built-in-plugins'

const analyzer = builtInPlugins.find(plugin => plugin.id === 'chinese-analyzer')!

describe('built-in plugin defaults', () => {
  it.each([
    ['ru', true],
    ['en-US', true],
    ['zh', false],
    ['zh-CN', false],
  ])('uses the interface language %s for the Chinese analyzer', (appLanguage, expected) => {
    expect(isBuiltInPluginEnabled(analyzer, {
      appLanguage,
      builtInPluginOverrides: {},
      legacyDisabledPlugins: [],
    })).toBe(expected)
  })

  it.each([
    ['ru', false, []],
    ['zh', true, []],
    ['en', true, [analyzer.id]],
  ])('honors a manual choice with interface language %s', (appLanguage, enabled, legacyDisabledPlugins) => {
    expect(isBuiltInPluginEnabled(analyzer, {
      appLanguage,
      builtInPluginOverrides: { [analyzer.id]: enabled },
      legacyDisabledPlugins,
    })).toBe(enabled)
  })

  it('preserves a disabled plugin from the old settings', () => {
    expect(isBuiltInPluginEnabled(analyzer, {
      appLanguage: 'en',
      builtInPluginOverrides: {},
      legacyDisabledPlugins: [analyzer.id],
    })).toBe(false)
  })
})
