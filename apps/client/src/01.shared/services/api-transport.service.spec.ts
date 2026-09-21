import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApiFetch, getSafeTransportUrl } from './api-transport.service'

describe('api transport telemetry', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('redacts query strings and identifier-like path segments', () => {
    const safeUrl = getSafeTransportUrl('https://api.example.test/api/books/123/pages/550e8400-e29b-41d4-a716-446655440000?token=secret')

    expect(safeUrl.path).toBe('/api/books/:param/pages/:param')
    expect(safeUrl.host).toBe('api.example.test')
  })

  it('resolves the browser fetch implementation at request time', async () => {
    const initialFetch = vi.fn().mockResolvedValue(new Response(null, { status: 204 }))
    const currentFetch = vi.fn().mockResolvedValue(new Response(null, { status: 200 }))
    vi.stubGlobal('fetch', initialFetch)

    const apiFetch = createApiFetch()
    vi.stubGlobal('fetch', currentFetch)

    await apiFetch('https://api.example.test/api/auth/me')

    expect(initialFetch).not.toHaveBeenCalled()
    expect(currentFetch).toHaveBeenCalledOnce()
  })
})
