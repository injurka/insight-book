import { flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope } from 'vue'
import { useNetworkStore } from '../store/network.store'
import { deferred } from './__tests__/helpers'
import { useNetworkTimeout } from './use-network-timeout'

beforeEach(() => {
  vi.useFakeTimers()
  setActivePinia(createPinia())
  useNetworkStore().isOnline = true
})
afterEach(() => vi.useRealTimers())

function setup(options = {}) {
  const scope = effectScope()
  const api = scope.run(() => useNetworkTimeout(options))!

  return { scope, api, store: useNetworkStore() }
}

describe('useNetworkTimeout', () => {
  it('opens the dialog after the configured timeout and clears it on success', async () => {
    const { scope, api, store } = setup({ timeoutMs: 100 })
    const result = deferred<string>()
    const promise = api.runWithTimeout(() => result.promise)
    await flushPromises()
    vi.advanceTimersByTime(99)
    expect(api.isTimeoutModalOpen.value).toBe(false)
    vi.advanceTimersByTime(1)
    expect(api.isTimeoutModalOpen.value).toBe(true)
    result.resolve('done')
    await expect(promise).resolves.toBe('done')
    expect(store.pendingControllers.size).toBe(0)
    expect(store.retryHandler).toBeNull()
    expect(store.isRequestPending).toBe(false)
    expect(vi.getTimerCount()).toBe(0)
    scope.stop()
  })

  it('cleans up after synchronous errors and rejected operations', async () => {
    const { scope, api, store } = setup()
    await expect(api.runWithTimeout(() => {
      throw new Error('sync')
    })).rejects.toThrow('sync')
    await expect(api.runWithTimeout(() => Promise.reject(new Error('async')))).rejects.toThrow('async')
    expect(store.pendingControllers.size).toBe(0)
    expect(store.retryHandler).toBeNull()
    scope.stop()
  })

  it('retries even when the first operation ignores its abort signal', async () => {
    const { scope, api } = setup()
    const first = deferred<string>()
    const fn = vi.fn().mockReturnValueOnce(first.promise).mockResolvedValueOnce('retry')
    const promise = api.runWithTimeout(fn)
    await flushPromises()
    api.retryRequest()
    await expect(promise).resolves.toBe('retry')
    expect(fn).toHaveBeenCalledTimes(2)
    expect(fn.mock.calls[0][0].aborted).toBe(true)
    first.resolve('obsolete')
    scope.stop()
  })

  it('keeps shared timeout state while another consumer is still pending', async () => {
    const first = setup({ timeoutMs: 100 })
    const second = setup({ timeoutMs: 100 })
    const a = deferred<string>()
    const b = deferred<string>()
    const pa = first.api.runWithTimeout(() => a.promise)
    const pb = second.api.runWithTimeout(() => b.promise)
    a.resolve('first')
    await pa
    expect(first.store.isRequestPending).toBe(true)
    expect(first.store.retryHandler).not.toBeNull()
    vi.advanceTimersByTime(100)
    expect(second.api.isTimeoutModalOpen.value).toBe(true)
    b.resolve('second')
    await pb
    expect(first.store.isRequestPending).toBe(false)
    first.scope.stop()
    second.scope.stop()
  })

  it('cancels every operation of a disposed scope without clearing another scope', async () => {
    const first = setup()
    const second = setup()
    const pa = first.api.runWithTimeout(() => new Promise(() => {}))
    const pb = first.api.runWithTimeout(() => new Promise(() => {}))
    const result = deferred<string>()
    const pc = second.api.runWithTimeout(() => result.promise)
    const assertions = Promise.all([
      expect(pa).rejects.toMatchObject({ name: 'AbortError' }),
      expect(pb).rejects.toMatchObject({ name: 'AbortError' }),
    ])
    first.scope.stop()
    await assertions
    expect(first.store.pendingControllers.size).toBe(1)
    expect(first.store.retryHandler).not.toBeNull()
    result.resolve('other')
    await pc
    await expect(first.api.runWithTimeout(() => Promise.resolve('late'))).rejects.toMatchObject({ name: 'AbortError' })
    second.scope.stop()
  })

  it('uses an aborted signal in offline mode without opening a dialog', async () => {
    const { scope, api, store } = setup()
    store.isForcedOffline = true
    const fn = vi.fn(async (signal: AbortSignal) => signal.aborted)
    await expect(api.runWithTimeout(fn)).resolves.toBe(true)
    expect(store.isRequestPending).toBe(false)
    scope.stop()
  })

  it('cancels on offline changes unless autoAbortOnOffline is disabled', async () => {
    const first = setup()
    const second = setup({ autoAbortOnOffline: false })
    const pa = first.api.runWithTimeout(() => new Promise(() => {}))
    const result = deferred<string>()
    const pb = second.api.runWithTimeout(() => result.promise)
    const assertion = expect(pa).rejects.toMatchObject({ name: 'AbortError' })
    first.api.enterOfflineMode()
    await assertion
    result.resolve('allowed')
    await expect(pb).resolves.toBe('allowed')
    first.scope.stop()
    second.scope.stop()
  })

  it('does not invoke an operation canceled before execution starts', async () => {
    const { scope, api } = setup()
    const fn = vi.fn(async () => 'never')
    const promise = api.runWithTimeout(fn)
    const assertion = expect(promise).rejects.toMatchObject({ name: 'AbortError' })
    scope.stop()
    await assertion
    expect(fn).not.toHaveBeenCalled()
  })
})
