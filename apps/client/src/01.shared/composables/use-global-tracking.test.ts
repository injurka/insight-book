import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, reactive, ref } from 'vue'
import { mountComposable } from './__tests__/helpers'

const mocks = vi.hoisted(() => ({ trackEvent: vi.fn(), identifyUser: vi.fn() }))
const settings = reactive({
  useCustomLlm: false,
  ttsSpeed: 1,
  readerFontSize: 16,
  readerFontFamily: 'serif',
  mangaOcrDisplayMode: 'original',
  appLanguage: 'en',
})
const theme = ref('light')
vi.mock('~/01.shared/store/settings.store', () => ({ useGlobalSettingsStore: () => settings }))
vi.mock('./use-tracking', () => ({ useTracking: () => mocks }))
vi.mock('~/01.shared/composables/use-change-theme', () => ({ themePreference: theme }))
const { useGlobalTracking } = await import('./use-global-tracking')

beforeEach(() => vi.clearAllMocks())

describe('useGlobalTracking', () => {
  it('tracks each setting change once without emitting initial values', async () => {
    const { wrapper } = mountComposable(useGlobalTracking)
    expect(mocks.trackEvent).not.toHaveBeenCalled()
    settings.useCustomLlm = true
    settings.ttsSpeed = 1.5
    settings.readerFontSize = 20
    settings.readerFontFamily = 'mono'
    settings.mangaOcrDisplayMode = 'translated'
    settings.appLanguage = 'ru'
    theme.value = 'dark'
    await nextTick()
    expect(mocks.trackEvent.mock.calls).toEqual(expect.arrayContaining([
      ['custom_llm_enabled', { enabled: true }],
      ['tts_speed_changed', { speed: 1.5 }],
      ['reader_font_size_changed', { size: 20 }],
      ['reader_font_family_changed', { font: 'mono' }],
      ['manga_ocr_mode_changed', { mode: 'translated' }],
      ['app_language_changed', { language: 'ru' }],
      ['theme_changed', { theme: 'dark' }],
    ]))
    expect(mocks.trackEvent).toHaveBeenCalledTimes(7)
    wrapper.unmount()
    settings.ttsSpeed = 2
    await nextTick()
    expect(mocks.trackEvent).toHaveBeenCalledTimes(7)
  })

  it('removes the appinstalled listener when unmounted', () => {
    const first = mountComposable(useGlobalTracking)
    window.dispatchEvent(new Event('appinstalled'))
    expect(mocks.trackEvent).toHaveBeenCalledOnce()
    first.wrapper.unmount()
    const second = mountComposable(useGlobalTracking)
    window.dispatchEvent(new Event('appinstalled'))
    expect(mocks.trackEvent).toHaveBeenCalledTimes(2)
    second.wrapper.unmount()
    window.dispatchEvent(new Event('appinstalled'))
    expect(mocks.trackEvent).toHaveBeenCalledTimes(2)
  })
})
