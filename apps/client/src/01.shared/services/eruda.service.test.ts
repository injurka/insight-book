import { beforeEach, describe, expect, it, vi } from 'vitest'

const erudaMock = vi.hoisted(() => ({
  init: vi.fn(),
  destroy: vi.fn(),
}))

vi.mock('eruda', () => ({
  default: erudaMock,
}))

describe('eruda service', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('lazy-loads eruda and initializes it once when enabled', async () => {
    const { setErudaEnabled } = await import('./eruda.service')

    await setErudaEnabled(true)
    await setErudaEnabled(true)

    expect(erudaMock.init).toHaveBeenCalledTimes(1)
  })

  it('destroys active eruda instance when disabled and allows re-enabling', async () => {
    const { setErudaEnabled } = await import('./eruda.service')

    await setErudaEnabled(true)
    await setErudaEnabled(false)
    await setErudaEnabled(false)

    expect(erudaMock.destroy).toHaveBeenCalledTimes(1)

    await setErudaEnabled(true)
    expect(erudaMock.init).toHaveBeenCalledTimes(2)
  })

  it('handles destroy errors gracefully and resets the instance', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    erudaMock.destroy.mockImplementationOnce(() => {
      throw new Error('destroy boom')
    })

    const { setErudaEnabled } = await import('./eruda.service')

    await setErudaEnabled(true)
    await setErudaEnabled(false)

    expect(errorSpy).toHaveBeenCalledWith('Failed to destroy eruda:', expect.any(Error))

    await setErudaEnabled(true)
    expect(erudaMock.init).toHaveBeenCalledTimes(2)
    errorSpy.mockRestore()
  })

  it('does not initialize eruda if disabled before async import resolves', async () => {
    const { setErudaEnabled } = await import('./eruda.service')

    const enabling = setErudaEnabled(true)
    const disabling = setErudaEnabled(false)

    await Promise.all([enabling, disabling])

    expect(erudaMock.init).not.toHaveBeenCalled()
    expect(erudaMock.destroy).not.toHaveBeenCalled()
  })
})
