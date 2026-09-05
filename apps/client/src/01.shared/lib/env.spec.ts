import { afterEach, describe, expect, it, vi } from 'vitest'

describe('env', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
    delete (window as { __APP_CONFIG__?: unknown }).__APP_CONFIG__
    delete (window as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__
    delete (window as { isTauri?: unknown }).isTauri
  })

  it('uses runtime config API_URL when set', async () => {
    ; (window as { __APP_CONFIG__?: { API_URL: string } }).__APP_CONFIG__ = { API_URL: 'https://runtime-api.com' }
    vi.stubEnv('VITE_API_URL', 'https://mock-api.com')
    const { API_URL } = await import('./env')

    expect(API_URL).toBe('https://runtime-api.com')
  })

  it('uses VITE_API_URL when set in web', async () => {
    vi.stubEnv('VITE_API_URL', 'https://mock-api.com')
    const { API_URL } = await import('./env')

    expect(API_URL).toBe('https://mock-api.com')
  })

  it('falls back to empty string when VITE_API_URL is not set in web', async () => {
    vi.stubEnv('VITE_API_URL', '')
    const { API_URL } = await import('./env')

    expect(API_URL).toBe('')
  })

  it('falls back to production API in Tauri when VITE_API_URL is not set', async () => {
    ; (window as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ = {}
    vi.stubEnv('VITE_API_URL', '')
    const { API_URL } = await import('./env')

    expect(API_URL).toBe('https://insight-book-api.limited-dissolve.ru')
  })

  it('falls back to production API in Tauri even if VITE_API_URL is set to localhost', async () => {
    ; (window as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ = {}
    vi.stubEnv('VITE_API_URL', 'http://localhost:4445')
    const { API_URL } = await import('./env')

    expect(API_URL).toBe('https://insight-book-api.limited-dissolve.ru')
  })

  it('detects Tauri via window.location.hostname tauri.localhost', async () => {
    const originalHostname = window.location.hostname
    Object.defineProperty(window, 'location', {
      value: { ...window.location, hostname: 'tauri.localhost' },
      writable: true,
      configurable: true,
    })

    vi.stubEnv('VITE_API_URL', 'http://localhost:4445')
    const { API_URL, isTauri } = await import('./env')

    expect(isTauri).toBe(true)
    expect(API_URL).toBe('https://insight-book-api.limited-dissolve.ru')

    Object.defineProperty(window, 'location', {
      value: { ...window.location, hostname: originalHostname },
      writable: true,
      configurable: true,
    })
  })

  it('uses custom remote VITE_API_URL in Tauri if explicitly specified', async () => {
    ; (window as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ = {}
    vi.stubEnv('VITE_API_URL', 'https://staging-api.insight-book.ru')
    const { API_URL } = await import('./env')

    expect(API_URL).toBe('https://staging-api.insight-book.ru')
  })
})
