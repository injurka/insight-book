import { expect, it } from 'vitest'
import { i18n, loadLanguageAsync, localePromise } from './i18n'

it('preserves plugin translations when loading and revisiting interface languages', async () => {
  await localePromise

  const translations = { ru: 'Разбор предложений', en: 'Sentence analysis', zh: '句子分析' }

  for (const [lang, title] of Object.entries(translations)) {
    i18n.global.mergeLocaleMessage(lang, {
      plugins: { 'chinese-analyzer': { navItemTitle: title, pageTitle: title } },
    })
  }

  for (const lang of ['en', 'zh', 'ru', 'en'] as const) {
    await loadLanguageAsync(lang)

    expect(i18n.global.locale.value).toBe(lang)
    expect(i18n.global.t('plugins.chinese-analyzer.navItemTitle')).toBe(translations[lang])
    expect(i18n.global.t('plugins.chinese-analyzer.pageTitle')).toBe(translations[lang])
    expect(i18n.global.te('plugins.chinese-analyzer.name')).toBe(true)
  }
})
