import { afterEach, describe, expect, it, vi } from 'vitest'

describe('env', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
    delete (window as { __APP_CONFIG__?: unknown }).__APP_CONFIG__
    delete (window as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__
  })

  it('uses runtime config API_URL when set', async () => {
    ;(window as { __APP_CONFIG__?: { API_URL: string } }).__APP_CONFIG__ = { API_URL: 'https://runtime-api.com' }
    vi.stubEnv('VITE_API_URL', 'https://mock-api.com')
    const { API_URL } = await import('./env')

    expect(API_URL).toBe('https://runtime-api.com')
  })

  it('uses VITE_API_URL when set', async () => {
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
    ;(window as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ = {}
    vi.stubEnv('VITE_API_URL', '')
    const { API_URL } = await import('./env')

    expect(API_URL).toBe('https://api.insight-book.ru')
  })
})
