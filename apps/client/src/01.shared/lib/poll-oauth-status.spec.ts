import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { pollOAuthStatus } from './poll-oauth-status'

describe('pollOAuthStatus', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it.each(['success', 'error'] as const)('returns terminal %s immediately', async (status) => {
    const result = { status }
    expect(await pollOAuthStatus(async () => result, { signal: new AbortController().signal })).toEqual(result)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('polls sequentially with the requested interval', async () => {
    const fetch = vi.fn().mockResolvedValueOnce({ status: 'pending' }).mockResolvedValue({ status: 'success', token: 'token' })
    const promise = pollOAuthStatus(fetch, { signal: new AbortController().signal, intervalMs: 100 })
    await vi.advanceTimersByTimeAsync(99)
    expect(fetch).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1)
    expect(await promise).toEqual({ status: 'success', token: 'token' })
    expect(vi.getTimerCount()).toBe(0)
  })

  it('does not start a request after cancellation', async () => {
    const controller = new AbortController()
    controller.abort()
    const fetch = vi.fn()
    await expect(pollOAuthStatus(fetch, { signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' })
    expect(fetch).not.toHaveBeenCalled()
  })

  it('cancels the pending interval and removes listeners', async () => {
    const controller = new AbortController()
    const remove = vi.spyOn(controller.signal, 'removeEventListener')
    const fetch = vi.fn().mockResolvedValue({ status: 'pending' })
    const promise = pollOAuthStatus(fetch, { signal: controller.signal })
    const rejected = expect(promise).rejects.toMatchObject({ name: 'AbortError' })
    await vi.advanceTimersByTimeAsync(0)
    controller.abort()
    await rejected
    await vi.advanceTimersByTimeAsync(5000)
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(remove).toHaveBeenCalledWith('abort', expect.any(Function))
    expect(vi.getTimerCount()).toBe(0)
  })

  it.each(['abort', 'timeout'] as const)('bounds a hung request on %s and ignores late success', async (action) => {
    const controller = new AbortController()
    let resolve!: (value: { status: 'success' }) => void
    const fetch = vi.fn(() => new Promise<{ status: 'success' }>((done) => {
      resolve = done
    }))
    const promise = pollOAuthStatus(fetch, { signal: controller.signal, timeoutMs: 100 })
    const rejected = expect(promise).rejects.toThrow(action === 'abort' ? 'aborted' : 'timed out')

    if (action === 'abort')
      controller.abort()
    else
      await vi.advanceTimersByTimeAsync(100)

    await rejected
    resolve({ status: 'success' })
    await vi.advanceTimersByTimeAsync(1000)
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('propagates request errors and cleans up the timeout', async () => {
    const error = new Error('network')
    await expect(pollOAuthStatus(async () => {
      throw error
    }, { signal: new AbortController().signal })).rejects.toBe(error)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('stops pending polling at the deadline', async () => {
    const promise = pollOAuthStatus(async () => ({ status: 'pending' }), { signal: new AbortController().signal, intervalMs: 40, timeoutMs: 100 })
    const rejected = expect(promise).rejects.toThrow('timed out')
    await vi.advanceTimersByTimeAsync(100)
    await rejected
    expect(vi.getTimerCount()).toBe(0)
  })

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])('rejects invalid timing %s', async (value) => {
    const fetch = vi.fn()
    await expect(pollOAuthStatus(fetch, { signal: new AbortController().signal, intervalMs: value })).rejects.toBeInstanceOf(RangeError)
    await expect(pollOAuthStatus(fetch, { signal: new AbortController().signal, timeoutMs: value })).rejects.toBeInstanceOf(RangeError)
    expect(fetch).not.toHaveBeenCalled()
  })
})
