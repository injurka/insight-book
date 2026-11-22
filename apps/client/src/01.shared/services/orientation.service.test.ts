import { beforeEach, describe, expect, it, vi } from 'vitest'
import { setScreenOrientation } from './orientation.service'

const invokeMock = vi.hoisted(() => vi.fn())

vi.mock('@tauri-apps/api/core', () => ({
  invoke: invokeMock,
}))

describe('orientation service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('invokes set_screen_orientation for landscape, portrait, and null reset', async () => {
    invokeMock.mockResolvedValue(undefined)

    await setScreenOrientation('landscape')
    await setScreenOrientation('portrait')
    await setScreenOrientation(null)

    expect(invokeMock).toHaveBeenNthCalledWith(1, 'set_screen_orientation', { mode: 'landscape' })
    expect(invokeMock).toHaveBeenNthCalledWith(2, 'set_screen_orientation', { mode: 'portrait' })
    expect(invokeMock).toHaveBeenNthCalledWith(3, 'set_screen_orientation', { mode: null })
  })

  it('logs a warning when Tauri invoke rejects', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const error = new Error('unsupported')
    invokeMock.mockRejectedValueOnce(error)

    await expect(setScreenOrientation('landscape')).resolves.toBeUndefined()
    expect(warnSpy).toHaveBeenCalledWith('Failed to set screen orientation', error)
    warnSpy.mockRestore()
  })
})
