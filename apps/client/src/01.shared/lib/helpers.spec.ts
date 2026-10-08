import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

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

describe('helpers: text and colors', () => {
  it('normalizes punctuation, whitespace, invisible characters and Unicode symbols', async () => {
    const { normalizeString } = await import('./helpers')
    expect(normalizeString('  HELLO,\u200B世界！ ❤️ ')).toBe('hello世界')
    expect(normalizeString('')).toBe('')
  })

  it('converts short/full hex and named colors with a predictable fallback', async () => {
    const { hexToRgba } = await import('./helpers')
    expect(hexToRgba('#f0a', 0.5)).toBe('rgba(255, 0, 170, 0.5)')
    expect(hexToRgba('#123456', 1)).toBe('rgba(18, 52, 86, 1)')
    expect(hexToRgba('YELLOW', 0.35)).toBe('rgba(253, 224, 71, 0.35)')
    expect(hexToRgba('', 0)).toBe('rgba(0, 0, 0, 0)')
    expect(hexToRgba('invalid', 1)).toBe('rgba(0, 0, 0, 1)')
    expect(hexToRgba('constructor', 1)).toBe('rgba(0, 0, 0, 1)')
    expect(hexToRgba('#zzffff', 1)).toBe('rgba(0, 0, 0, 1)')
  })

  it('decodes valid URI text and preserves malformed values', async () => {
    const { safeDecodeURIComponent } = await import('./helpers')
    expect(safeDecodeURIComponent('%E4%BD%A0%E5%A5%BD')).toBe('你好')
    expect(safeDecodeURIComponent('%ZZ')).toBe('%ZZ')
    expect(safeDecodeURIComponent('')).toBe('')
  })
})

describe('helpers: media URL boundaries', () => {
  beforeEach(() => vi.resetModules())
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })
  it('keeps API image endpoints off CDN and normalizes trailing base slashes', async () => {
    vi.stubEnv('VITE_API_URL', 'https://api.test.com/')
    vi.stubEnv('VITE_CDN_URL', 'https://cdn.test.com/')
    const { getMediaUrl } = await import('./helpers')
    expect(getMediaUrl('/api/books/1/page/2/image')).toBe('https://api.test.com/api/books/1/page/2/image')
    expect(getMediaUrl('/uploads/image.png')).toBe('https://cdn.test.com/image.png')
    expect(getMediaUrl('/image.png')).toBe('https://cdn.test.com/image.png')
  })
  it('does not rewrite an upload-looking query or nested external URL', async () => {
    vi.stubEnv('VITE_CDN_URL', 'https://cdn.test.com')
    const { getMediaUrl } = await import('./helpers')

    for (const url of ['https://external.com/image?src=/api/uploads/cover.jpg', 'https://external.com/nested/api/uploads/cover.jpg'])
      expect(getMediaUrl(url)).toBe(url)
  })
})
