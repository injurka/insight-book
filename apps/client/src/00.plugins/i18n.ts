import { nextTick } from 'vue'
import { createI18n } from 'vue-i18n'
import { APP_LANGUAGE_STORAGE_KEY, DEFAULT_APP_LANGUAGE, getInitialAppLanguage } from '~/01.shared/lib/app-language'

const locale = getInitialAppLanguage()

export const i18n = createI18n({
  legacy: false,
  locale,
  fallbackLocale: DEFAULT_APP_LANGUAGE,
  messages: {},
})

function applyLanguage(lang: string) {
  i18n.global.locale.value = lang

  if (typeof document !== 'undefined')
    document.documentElement.lang = lang

  try {
    localStorage.setItem(APP_LANGUAGE_STORAGE_KEY, lang)
  }
  catch {
    // Keep the current locale in memory if storage is unavailable.
  }
}

const loadedLocales = new Set<string>()

const localeLoaders = import.meta.glob<{ default: Record<string, unknown> }>('../01.shared/locales/*.json')

export async function loadLanguageAsync(lang: string) {
  // 1. Если язык уже установлен, ничего не делаем
  if (i18n.global.locale.value === lang && loadedLocales.has(lang))
    return nextTick()

  // 2. Если язык уже загружался ранее, просто переключаем локаль
  if (loadedLocales.has(lang)) {
    applyLanguage(lang)

    return nextTick()
  }

  // 3. Если языка нет в памяти, загружаем его JSON-файл
  try {
    const loader = localeLoaders[`../01.shared/locales/${lang}.json`]

    if (!loader)
      throw new Error(`Неизвестная локаль: ${lang}`)

    const messages = await loader()

    // В зависимости от сборщика (Vite/Webpack), JSON может лежать в default
    i18n.global.setLocaleMessage(lang, messages.default || messages)

    // Отмечаем язык как загруженный
    loadedLocales.add(lang)

    applyLanguage(lang)
  }
  catch (error) {
    console.error(`Ошибка при загрузке языка: ${lang}`, error)
  }

  return nextTick()
}

export const localePromise = loadLanguageAsync(locale)
