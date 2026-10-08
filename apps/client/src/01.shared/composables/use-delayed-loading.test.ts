import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, ref } from 'vue'
import { useDelayedLoading } from './use-delayed-loading'

describe('useDelayedLoading', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('delays initial loading and hides synchronously', () => {
    const source = ref(true)
    const scope = effectScope()
    const loading = scope.run(() => useDelayedLoading(source))!
    vi.advanceTimersByTime(299)
    expect(loading.value).toBe(false)
    vi.advanceTimersByTime(1)
    expect(loading.value).toBe(true)
    source.value = false
    expect(loading.value).toBe(false)
    scope.stop()
  })

  it('cancels short loads and starts a fresh delay on a new load', () => {
    const source = ref(false)
    const scope = effectScope()
    const loading = scope.run(() => useDelayedLoading(() => source.value, 100))!
    source.value = true
    vi.advanceTimersByTime(90)
    source.value = false
    source.value = true
    vi.advanceTimersByTime(90)
    expect(loading.value).toBe(false)
    vi.advanceTimersByTime(10)
    expect(loading.value).toBe(true)
    scope.stop()
    expect(loading.value).toBe(false)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('does not update after scope disposal', () => {
    const scope = effectScope()
    const loading = scope.run(() => useDelayedLoading(ref(true), 0))!
    scope.stop()
    vi.runAllTimers()
    expect(loading.value).toBe(false)
  })
})
