import { beforeEach, describe, expect, it, vi } from 'vitest'
import { setImmersiveMode } from './immersive.service'

const invokeMock = vi.hoisted(() => vi.fn())

vi.mock('@tauri-apps/api/core', () => ({
  invoke: invokeMock,
}))

describe('immersive service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('invokes set_immersive_mode with the enabled flag', async () => {
    invokeMock.mockResolvedValue(undefined)

    await setImmersiveMode(true)
    await setImmersiveMode(false)

    expect(invokeMock).toHaveBeenNthCalledWith(1, 'set_immersive_mode', { enabled: true })
    expect(invokeMock).toHaveBeenNthCalledWith(2, 'set_immersive_mode', { enabled: false })
  })

  it('logs a warning instead of throwing when Tauri invoke fails', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const error = new Error('not available')
    invokeMock.mockRejectedValueOnce(error)

    await expect(setImmersiveMode(true)).resolves.toBeUndefined()
    expect(warnSpy).toHaveBeenCalledWith('Failed to set immersive mode', error)
    warnSpy.mockRestore()
  })
})
