import { afterEach, describe, expect, it, vi } from 'vitest'
import { APP_LANGUAGE_STORAGE_KEY, getInitialAppLanguage } from './app-language'

describe('initial interface language', () => {
  afterEach(() => {
    localStorage.removeItem(APP_LANGUAGE_STORAGE_KEY)
    vi.unstubAllGlobals()
  })

  it('chooses the first supported browser preference', () => {
    vi.stubGlobal('navigator', { languages: ['de-DE', 'zh-CN', 'en-GB'], language: 'de-DE' })
    expect(getInitialAppLanguage()).toBe('zh')
  })

  it('uses navigator.language when the preference list is unavailable', () => {
    vi.stubGlobal('navigator', { language: 'en-GB' })
    expect(getInitialAppLanguage()).toBe('en')
  })

  it.each(['ru', '"ru"'])('gives the saved setting %s priority over the browser', (saved) => {
    localStorage.setItem(APP_LANGUAGE_STORAGE_KEY, saved)
    vi.stubGlobal('navigator', { languages: ['en-GB'], language: 'en-GB' })
    expect(getInitialAppLanguage()).toBe('ru')
  })

  it('uses the default when neither storage nor browser has a supported language', () => {
    localStorage.setItem(APP_LANGUAGE_STORAGE_KEY, 'fr')
    vi.stubGlobal('navigator', { languages: ['de-DE'], language: 'de-DE' })
    expect(getInitialAppLanguage()).toBe('ru')
  })
})
