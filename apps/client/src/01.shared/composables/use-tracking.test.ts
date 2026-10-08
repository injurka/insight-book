import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useTracking } from './use-tracking'

const mocks = vi.hoisted(() => ({ event: vi.fn(), user: vi.fn() }))
vi.mock('~/01.shared/services/monitoring.service', () => ({
  trackEvent: mocks.event,
  setTelemetryUser: mocks.user,
}))
beforeEach(() => vi.clearAllMocks())
afterEach(() => vi.unstubAllGlobals())

describe('useTracking', () => {
  it('forwards events and keeps optional data intact', () => {
    useTracking().trackEvent('pwa_installed')
    useTracking().trackEvent('theme_changed', { theme: 'dark' })
    expect(mocks.event.mock.calls).toEqual([
      ['pwa_installed', undefined],
      ['theme_changed', { theme: 'dark' }],
    ])
  })

  it('identifies valid IDs including zero, and ignores attributes without an ID', () => {
    useTracking().identifyUser({ current_theme: 'dark' })
    expect(mocks.user).not.toHaveBeenCalled()
    useTracking().identifyUser({ id: 0, username: 'test', role: 'reader', private: 'ignored' })
    expect(mocks.user).toHaveBeenCalledWith({ id: 0, username: 'test', role: 'reader' })
  })

  it('uses the document title by default and respects an explicit empty title', () => {
    document.title = 'Reader'
    useTracking().trackPageview('/reader')
    useTracking().trackPageview('/reader', '')
    expect(mocks.event.mock.calls).toEqual([
      ['page_view', { url: '/reader', title: 'Reader' }],
      ['page_view', { url: '/reader', title: '' }],
    ])
    vi.stubGlobal('document', undefined)
    expect(() => useTracking().trackPageview('/')).not.toThrow()
  })
})
