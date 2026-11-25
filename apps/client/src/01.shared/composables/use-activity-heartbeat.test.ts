import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, reactive } from 'vue'
import { AppRouteNames } from '~/01.shared/constants/routes'
import { resolveActivitySection, useActivityHeartbeat } from './use-activity-heartbeat'

const mocks = vi.hoisted(() => ({
  sendHeartbeat: vi.fn().mockResolvedValue(undefined),
  route: { name: 'home' as string },
  auth: { user: { id: 1, username: 'alice' } as { id: number, username: string } | null },
  network: { effectiveOffline: false },
}))

vi.mock('vue-router', () => ({
  useRoute: () => mocks.route,
}))

vi.mock('~/00.plugins/di', () => ({
  useRepos: () => ({
    activity: {
      sendHeartbeat: mocks.sendHeartbeat,
    },
  }),
}))

vi.mock('~/01.shared/store/auth.store', () => ({
  useAuthStore: () => mocks.auth,
}))

vi.mock('~/01.shared/store/network.store', () => ({
  useNetworkStore: () => mocks.network,
}))

function mountHarness() {
  const Harness = defineComponent({
    setup() {
      useActivityHeartbeat()

      return () => h('div')
    },
  })

  return mount(Harness)
}

describe('resolveActivitySection', () => {
  it('maps routes to sections', () => {
    expect(resolveActivitySection(AppRouteNames.Reader)).toBe('reader')
    expect(resolveActivitySection(AppRouteNames.Dictionary)).toBe('srs')
    expect(resolveActivitySection(AppRouteNames.BookDeck)).toBe('srs')
    expect(resolveActivitySection(AppRouteNames.Home)).toBe('library')
    expect(resolveActivitySection(AppRouteNames.BookInfo)).toBe('library')
    expect(resolveActivitySection(AppRouteNames.Settings)).toBe('other')
  })
})

describe('useActivityHeartbeat', () => {
  const originalVisibility = Object.getOwnPropertyDescriptor(document, 'visibilityState')

  function setVisibility(state: 'visible' | 'hidden') {
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => state,
    })
  }

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-25T10:00:00.000Z'))
    mocks.sendHeartbeat.mockClear()
    const reactiveRoute = reactive({ name: AppRouteNames.Home as string })
    const reactiveAuth = reactive({ user: { id: 1, username: 'alice' } as { id: number, username: string } | null })
    const reactiveNetwork = reactive({ effectiveOffline: false })
    mocks.route = reactiveRoute
    mocks.auth = reactiveAuth
    mocks.network = reactiveNetwork
    setVisibility('visible')
  })

  afterEach(() => {
    vi.useRealTimers()

    if (originalVisibility)
      Object.defineProperty(document, 'visibilityState', originalVisibility)
  })

  it('flushes active seconds after threshold while user is active', async () => {
    const wrapper = mountHarness()

    // Simulate user interacting every 15s for 30s
    await vi.advanceTimersByTimeAsync(15_000)
    window.dispatchEvent(new Event('pointerdown'))
    await vi.advanceTimersByTimeAsync(15_000)

    expect(mocks.sendHeartbeat).toHaveBeenCalledTimes(1)
    expect(mocks.sendHeartbeat).toHaveBeenCalledWith(30, 'library', { keepalive: undefined })

    wrapper.unmount()
  })

  it('stops accumulating time once user becomes idle', async () => {
    const wrapper = mountHarness()

    // Advance 90s without interaction: only first 60s are active (2 flushes of 30s), last 30s are idle
    await vi.advanceTimersByTimeAsync(90_000)
    expect(mocks.sendHeartbeat).toHaveBeenCalledTimes(2)

    await vi.advanceTimersByTimeAsync(60_000)
    expect(mocks.sendHeartbeat).toHaveBeenCalledTimes(2)

    wrapper.unmount()
  })

  it('flushes previous section when switching routes and keeps reader idle window longer', async () => {
    const wrapper = mountHarness()

    await vi.advanceTimersByTimeAsync(10_000)
    mocks.route.name = AppRouteNames.Reader
    await Promise.resolve()

    expect(mocks.sendHeartbeat).toHaveBeenCalledWith(10, 'library', { keepalive: undefined })
    mocks.sendHeartbeat.mockClear()

    // In reader, 70s without interaction is still inside 90s reader timeout
    await vi.advanceTimersByTimeAsync(70_000)
    expect(mocks.sendHeartbeat).toHaveBeenCalledWith(30, 'reader', { keepalive: undefined })

    wrapper.unmount()
  })

  it('flushes with keepalive on visibility hidden and pagehide, and resets clock on visible', async () => {
    const wrapper = mountHarness()

    await vi.advanceTimersByTimeAsync(10_000)
    setVisibility('hidden')
    document.dispatchEvent(new Event('visibilitychange'))

    expect(mocks.sendHeartbeat).toHaveBeenCalledWith(10, 'library', { keepalive: true })
    mocks.sendHeartbeat.mockClear()

    // Time while hidden is not accumulated
    await vi.advanceTimersByTimeAsync(40_000)
    setVisibility('visible')
    document.dispatchEvent(new Event('visibilitychange'))
    expect(mocks.sendHeartbeat).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(10_000)
    window.dispatchEvent(new Event('pagehide'))
    expect(mocks.sendHeartbeat).toHaveBeenCalledWith(10, 'library', { keepalive: true })

    wrapper.unmount()
  })

  it('does not send heartbeats when offline or logged out', async () => {
    const wrapper = mountHarness()

    mocks.network.effectiveOffline = true
    await vi.advanceTimersByTimeAsync(35_000)
    expect(mocks.sendHeartbeat).not.toHaveBeenCalled()

    mocks.network.effectiveOffline = false
    mocks.auth.user = null
    await Promise.resolve()
    await vi.advanceTimersByTimeAsync(35_000)
    expect(mocks.sendHeartbeat).not.toHaveBeenCalled()

    // Re-authenticate resets clock cleanly
    mocks.auth.user = { id: 2, username: 'bob' }
    await Promise.resolve()
    await vi.advanceTimersByTimeAsync(30_000)
    expect(mocks.sendHeartbeat).toHaveBeenCalledWith(30, 'library', { keepalive: undefined })

    wrapper.unmount()
  })

  it('swallows heartbeat transport errors silently and ignores same-section route changes', async () => {
    mocks.sendHeartbeat.mockRejectedValueOnce(new Error('network error'))
    const wrapper = mountHarness()

    mocks.route.name = AppRouteNames.BookInfo
    await Promise.resolve()
    await vi.advanceTimersByTimeAsync(30_000)
    await Promise.resolve()

    expect(mocks.sendHeartbeat).toHaveBeenCalledTimes(1)
    wrapper.unmount()
  })
})
