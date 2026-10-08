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

describe('offline fallback boundaries', () => {
  it.each([null, undefined, '', 500, 'network', {}, { status: 'invalid' }])('rejects unclassified error %s', (error) => {
    expect(canUseOfflineFallback(error)).toBe(false)
  })
  it.each([{ status: 0 }, { statusCode: '503' }, { response: { status: 502 } }, { status: 'bad', statusCode: 500 }])('accepts unavailable server %s', (error) => {
    expect(canUseOfflineFallback(error)).toBe(true)
  })
  it.each([{ status: 403 }, { status: 429 }, { status: 200 }, { status: 400, response: { status: 503 } }])('respects HTTP status %s', (error) => {
    expect(canUseOfflineFallback(error)).toBe(false)
  })
  it.each(['Failed to fetch', 'Network error', 'fetch failed', 'error sending request', 'connection refused', 'DNS unavailable', 'timed out'])('accepts transport error %s', (message) => {
    expect(canUseOfflineFallback(new Error(message))).toBe(true)
  })
  it('handles TypeError and FetchError but preserves ordinary application errors', () => {
    expect(canUseOfflineFallback(new TypeError('fetch'))).toBe(true)
    expect(canUseOfflineFallback(Object.assign(new Error('fetch'), { name: 'FetchError' }))).toBe(true)
    expect(canUseOfflineFallback(new Error('invalid data'))).toBe(false)
    expect(canUseOfflineFallback(Object.assign(new Error('timeout'), { name: 'AbortError' }))).toBe(true)
  })
})
