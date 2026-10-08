import { afterEach, describe, expect, it, vi } from 'vitest'
import { useHaptic } from './use-haptic'

afterEach(() => vi.unstubAllGlobals())

describe('useHaptic', () => {
  it('passes the default, custom and preset patterns to the device', () => {
    const vibrate = vi.fn()
    vi.stubGlobal('navigator', { vibrate })
    const api = useHaptic()
    api.vibrate()
    api.vibrate([1, 2])
    api.hapticLight()
    api.hapticMedium()
    api.hapticHeavy()
    expect(vibrate.mock.calls).toEqual([[50], [[1, 2]], [10], [40], [[50, 100, 50]]])
  })

  it('tolerates unsupported devices and rejected vibration', () => {
    vi.stubGlobal('navigator', undefined)
    expect(() => useHaptic().vibrate()).not.toThrow()
    vi.stubGlobal('navigator', {})
    expect(() => useHaptic().vibrate()).not.toThrow()
    vi.stubGlobal('navigator', {
      vibrate: () => {
        throw new Error('blocked')
      },
    })
    expect(() => useHaptic().vibrate()).not.toThrow()
  })
})
