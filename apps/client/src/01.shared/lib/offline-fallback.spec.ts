import { describe, expect, it } from 'vitest'
import { canUseOfflineFallback } from './offline-fallback'

describe('canUseOfflineFallback', () => {
  it('allows cached data after a client timeout', () => {
    const error = new Error('Request exceeded the 20000 ms client timeout')
    error.name = 'TimeoutError'

    expect(canUseOfflineFallback(error)).toBe(true)
  })

  it('does not treat an explicit request cancellation as offline', () => {
    const error = new Error('Request was aborted')
    error.name = 'AbortError'

    expect(canUseOfflineFallback(error)).toBe(false)
  })

  it('does not hide authorization and not-found responses with cached data', () => {
    expect(canUseOfflineFallback({ status: 401 })).toBe(false)
    expect(canUseOfflineFallback({ status: 404 })).toBe(false)
    expect(canUseOfflineFallback({ status: 503 })).toBe(true)
  })
})
