import { createI18n } from 'vue-i18n'
import cn from '../locales/cn.json'
import en from '../locales/en.json'
import ru from '../locales/ru.json'

const savedLocale = localStorage.getItem('app-locale') || 'ru'

export const i18n = createI18n({
  legacy: false,
  locale: savedLocale,
  fallbackLocale: 'en',
  messages: {
    ru,
    en,
    cn,
  },
})
