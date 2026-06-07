import { createI18n } from 'vue-i18n'
import zh from '../locales/zh.json'
import en from '../locales/en.json'
import ru from '../locales/ru.json'

let locale = 'ru'
try {
  const saved = localStorage.getItem('global-app-language')
  if (saved) {
    locale = JSON.parse(saved)
  }
}
catch {
  // ignore
}

export const i18n = createI18n({
  legacy: false,
  locale,
  fallbackLocale: 'en',
  messages: {
    ru,
    en,
    zh,
  },
})
