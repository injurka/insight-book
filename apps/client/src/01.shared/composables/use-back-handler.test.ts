import { describe, expect, it, vi } from 'vitest'
import { effectScope } from 'vue'
import { useBackHandler } from './use-back-handler'

describe('useBackHandler', () => {
  it('uses LIFO order across consumers and cleans up only the disposed scope', () => {
    const first = effectScope()
    const second = effectScope()
    const a = vi.fn()
    const b = vi.fn()
    const api = first.run(useBackHandler)!
    api.registerBackHandler(a)
    second.run(() => useBackHandler().registerBackHandler(b))
    expect(api.triggerBack()).toBe(true)
    expect(b).toHaveBeenCalledOnce()
    expect(a).not.toHaveBeenCalled()
    second.stop()
    api.triggerBack()
    expect(a).toHaveBeenCalledOnce()
    first.stop()
    expect(api.triggerBack()).toBe(false)
  })

  it('treats duplicate callbacks as distinct registrations with idempotent removal', () => {
    const scope = effectScope()
    const api = scope.run(useBackHandler)!
    const callback = vi.fn()
    const removeFirst = api.registerBackHandler(callback)
    const removeSecond = api.registerBackHandler(callback)
    removeFirst()
    removeFirst()
    api.triggerBack()
    expect(callback).toHaveBeenCalledOnce()
    removeSecond()
    expect(api.triggerBack()).toBe(false)
    scope.stop()
  })
})
