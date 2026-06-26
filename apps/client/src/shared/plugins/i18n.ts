import { nextTick } from 'vue'
import { createI18n } from 'vue-i18n'

let locale = 'ru'

try {
  const saved = localStorage.getItem('global-app-language')
  if (saved) {
    locale = saved.replace(/^"|"$/g, '')
  }
}
catch {
  // Игнорируем ошибки парсинга
}

export const i18n = createI18n({
  legacy: false,
  locale,
  fallbackLocale: 'ru',
  messages: {},
})

const loadedLocales = new Set<string>()

export async function loadLanguageAsync(lang: string) {
  // 1. Если язык уже установлен, ничего не делаем
  if (i18n.global.locale.value === lang && loadedLocales.has(lang)) {
    return nextTick()
  }

  // 2. Если язык уже загружался ранее, просто переключаем локаль
  if (loadedLocales.has(lang)) {
    i18n.global.locale.value = lang
    localStorage.setItem('global-app-language', lang)
    return nextTick()
  }

  // 3. Если языка нет в памяти, загружаем его JSON-файл
  try {
    const messages = await import(`../locales/${lang}.json`)

    // В зависимости от сборщика (Vite/Webpack), JSON может лежать в default
    i18n.global.setLocaleMessage(lang, messages.default || messages)

    // Отмечаем язык как загруженный
    loadedLocales.add(lang)

    // Устанавливаем язык интерфейса
    i18n.global.locale.value = lang

    // Сохраняем выбор пользователя
    localStorage.setItem('global-app-language', lang)
  }
  catch (error) {
    console.error(`Ошибка при загрузке языка: ${lang}`, error)
  }

  return nextTick()
}

loadLanguageAsync(locale)
