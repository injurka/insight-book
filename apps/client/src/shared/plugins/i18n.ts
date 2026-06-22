import { createI18n } from 'vue-i18n'

let locale = 'ru'

try {
  const saved = localStorage.getItem('global-app-language')
  if (saved)
    locale = JSON.parse(saved)
}
catch { }

export const i18n = createI18n({
  legacy: false,
  locale,
  fallbackLocale: 'en',
  messages: {},
})

export async function loadLanguageAsync(lang: string) {
  const messages = await import(`../locales/${lang}.json`)

  i18n.global.setLocaleMessage(lang, messages.default)
  i18n.global.locale.value = lang

  return nextTick()
}

loadLanguageAsync(locale)
