import { beforeEach, describe, expect, it, vi } from 'vitest'
import { syncSystemBarsTheme } from './system-bars.service'

const invokeMock = vi.hoisted(() => vi.fn())

vi.mock('@tauri-apps/api/core', () => ({
  invoke: invokeMock,
}))

describe('system bars service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('invokes set_system_bars_theme with the dark flag', async () => {
    invokeMock.mockResolvedValue(undefined)

    await syncSystemBarsTheme(true)
    await syncSystemBarsTheme(false)

    expect(invokeMock).toHaveBeenNthCalledWith(1, 'set_system_bars_theme', { dark: true })
    expect(invokeMock).toHaveBeenNthCalledWith(2, 'set_system_bars_theme', { dark: false })
  })

  it('logs a warning when Tauri invoke rejects', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const error = new Error('platform error')
    invokeMock.mockRejectedValueOnce(error)

    await expect(syncSystemBarsTheme(true)).resolves.toBeUndefined()
    expect(warnSpy).toHaveBeenCalledWith('Failed to synchronize system bars theme', error)
    warnSpy.mockRestore()
  })
})
