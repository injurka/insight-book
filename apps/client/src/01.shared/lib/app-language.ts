export const APP_LANGUAGE_STORAGE_KEY = 'global-app-language'
export const DEFAULT_APP_LANGUAGE = 'ru'

const supportedLanguages = new Set(['ru', 'en', 'zh'])

export function normalizeAppLanguage(value: string): string | undefined {
  const language = value.trim().replace(/^"|"$/g, '').toLowerCase().split(/[-_]/, 1)[0]

  return supportedLanguages.has(language) ? language : undefined
}

export function getInitialAppLanguage(): string {
  try {
    const saved = normalizeAppLanguage(globalThis.localStorage?.getItem(APP_LANGUAGE_STORAGE_KEY) ?? '')

    if (saved)
      return saved
  }
  catch {
    // Storage can be disabled by browser privacy settings.
  }

  const { languages = [], language = '' } = globalThis.navigator ?? {}

  return [...languages, language].map(normalizeAppLanguage).find(Boolean) ?? DEFAULT_APP_LANGUAGE
}
