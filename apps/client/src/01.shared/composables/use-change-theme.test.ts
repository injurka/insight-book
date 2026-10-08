import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, ref } from 'vue'

const mocks = vi.hoisted(() => ({ head: vi.fn(), bars: vi.fn() }))
const preference = ref('system')
const dark = ref(false)
vi.mock('@vueuse/core', () => ({ useStorage: () => preference, usePreferredDark: () => dark }))
vi.mock('@vueuse/head', () => ({ useHead: mocks.head }))
vi.mock('~/01.shared/lib/env', () => ({ isMobileApp: true }))
vi.mock('~/01.shared/services/system-bars.service', () => ({ syncSystemBarsTheme: mocks.bars }))

const { ThemesVariant, useChangeTheme } = await import('./use-change-theme')

beforeEach(() => {
  vi.clearAllMocks()
  preference.value = ThemesVariant.System
  dark.value = false
})
afterEach(() => vi.unstubAllGlobals())

describe('useChangeTheme', () => {
  it('reacts to system preference and provides matching head metadata', async () => {
    const scope = effectScope()
    const api = scope.run(useChangeTheme)!
    expect(document.documentElement.dataset.theme).toBe('light')
    expect(api.getHeadThemeColor()).toBe('#faf4f2')
    dark.value = true
    await nextTick()
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(mocks.bars).toHaveBeenLastCalledWith(true)
    const head = mocks.head.mock.calls[0][0]
    expect(head.meta[0].content()).toBe('#0d1117')
    expect(head.meta[1].content()).toBe('black-translucent')
    scope.stop()
  })

  it('cycles every theme and resolves explicit themes independently of the OS', async () => {
    const scope = effectScope()
    const api = scope.run(useChangeTheme)!

    for (const theme of ['light', 'sepia', 'green', 'dark', 'oled', 'system']) {
      api.toggleTheme()
      await nextTick()
      expect(api.theme.value).toBe(theme)
    }

    api.setTheme(ThemesVariant.Oled)
    await nextTick()
    expect(api.getHeadThemeColor()).toBe('#000000')
    scope.stop()
    api.setTheme(ThemesVariant.Light)
    await nextTick()
    expect(document.documentElement.dataset.theme).toBe('oled')
  })

  it('falls back for corrupt stored values and tolerates missing DOM', async () => {
    preference.value = 'invalid' as ThemesVariant
    const scope = effectScope()
    const api = scope.run(useChangeTheme)!
    expect(api.getHeadThemeColor()).toBe('#faf4f2')
    vi.stubGlobal('document', undefined)
    api.setTheme(ThemesVariant.Dark)
    await nextTick()
    scope.stop()
  })
})
