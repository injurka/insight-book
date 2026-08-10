import { afterEach, describe, expect, it, vi } from 'vitest'

describe('helpers: getMediaUrl', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
    delete (window as { __APP_CONFIG__?: unknown }).__APP_CONFIG__
  })

  it('returns empty string when path is falsy', async () => {
    const { getMediaUrl } = await import('./helpers')
    expect(getMediaUrl(null)).toBe('')
    expect(getMediaUrl('')).toBe('')
  })

  it('returns data and blob URLs unchanged', async () => {
    const { getMediaUrl } = await import('./helpers')
    expect(getMediaUrl('data:image/png;base64,123')).toBe('data:image/png;base64,123')
    expect(getMediaUrl('blob:http://localhost/123')).toBe('blob:http://localhost/123')
  })

  it('uses API_URL when CDN_URL is empty', async () => {
    vi.stubEnv('VITE_API_URL', 'https://api.test.com')
    vi.stubEnv('VITE_CDN_URL', '')
    const { getMediaUrl } = await import('./helpers')

    expect(getMediaUrl('/api/uploads/covers/test.jpg')).toBe('https://api.test.com/api/uploads/covers/test.jpg')
    expect(getMediaUrl('covers/test.jpg')).toBe('https://api.test.com/covers/test.jpg')
  })

  it('uses CDN_URL for relative upload paths', async () => {
    vi.stubEnv('VITE_API_URL', 'https://api.test.com')
    vi.stubEnv('VITE_CDN_URL', 'https://cdn.test.com')
    const { getMediaUrl } = await import('./helpers')

    expect(getMediaUrl('/api/uploads/covers/test.jpg')).toBe('https://cdn.test.com/covers/test.jpg')
    expect(getMediaUrl('covers/test.jpg')).toBe('https://cdn.test.com/covers/test.jpg')
  })

  it('transforms absolute API upload URLs to CDN_URL', async () => {
    vi.stubEnv('VITE_API_URL', 'https://api.test.com')
    vi.stubEnv('VITE_CDN_URL', 'https://cdn.test.com')
    const { getMediaUrl } = await import('./helpers')

    expect(getMediaUrl('https://api.test.com/api/uploads/covers/test.jpg')).toBe('https://cdn.test.com/covers/test.jpg')
    expect(getMediaUrl('https://insight-book-api.limited-dissolve.ru/api/uploads/covers/123_cover.jpg')).toBe('https://cdn.test.com/covers/123_cover.jpg')
  })

  it('leaves external third-party URLs unchanged', async () => {
    vi.stubEnv('VITE_CDN_URL', 'https://cdn.test.com')
    const { getMediaUrl } = await import('./helpers')

    expect(getMediaUrl('https://external.com/image.png')).toBe('https://external.com/image.png')
  })
})
