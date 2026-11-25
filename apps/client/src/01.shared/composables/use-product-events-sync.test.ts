import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, reactive } from 'vue'
import {
  clearProductEventsQueue,
  enqueueProductEvent,
  getPendingProductEventsCount,
  IMMEDIATE_FLUSH_BATCH_SIZE,
} from '~/01.shared/services/product-events.service'
import { useProductEventsSync } from './use-product-events-sync'

const mocks = vi.hoisted(() => ({
  sendEvents: vi.fn().mockResolvedValue(undefined),
  auth: { user: { id: 1, username: 'alice' } as { id: number, username: string } | null },
  network: { effectiveOffline: false },
}))

vi.mock('~/00.plugins/di', () => ({
  useRepos: () => ({
    activity: {
      sendEvents: mocks.sendEvents,
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
      useProductEventsSync()

      return () => h('div')
    },
  })

  return mount(Harness)
}

describe('useProductEventsSync + product-events.service', () => {
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
    clearProductEventsQueue()
    mocks.sendEvents.mockReset().mockResolvedValue(undefined)
    mocks.auth = reactive({ user: { id: 1, username: 'alice' } as { id: number, username: string } | null })
    mocks.network = reactive({ effectiveOffline: false })
    setVisibility('visible')
  })

  afterEach(() => {
    vi.useRealTimers()
    clearProductEventsQueue()

    if (originalVisibility)
      Object.defineProperty(document, 'visibilityState', originalVisibility)
  })

  it('filters noisy events, redacts text fields, throttles search, and flushes on interval', async () => {
    const wrapper = mountHarness()

    expect(enqueueProductEvent('theme_changed', { theme: 'dark' })).toBe(false)
    expect(enqueueProductEvent('public_book_search', { query: 'harry potter' })).toBe(true)
    // Cooldown suppresses duplicate within 2.5s
    expect(enqueueProductEvent('public_book_search', { query: 'harry potter 2' })).toBe(false)
    expect(enqueueProductEvent('book_opened', { bookId: 5, language: 'en' })).toBe(true)

    expect(getPendingProductEventsCount()).toBe(2)

    await vi.advanceTimersByTimeAsync(15_000)

    expect(mocks.sendEvents).toHaveBeenCalledTimes(1)
    const [sentBatch, opts] = mocks.sendEvents.mock.calls[0]
    expect(opts).toEqual({ keepalive: undefined })
    expect(sentBatch).toEqual([
      { event: 'public_book_search', meta: { query_len: 12 }, timestamp: '2026-11-25T10:00:00.000Z' },
      { event: 'book_opened', meta: { bookId: 5, language: 'en' }, timestamp: '2026-11-25T10:00:00.000Z' },
    ])
    expect(getPendingProductEventsCount()).toBe(0)

    wrapper.unmount()
  })

  it('flushes immediately when batch reaches threshold and restores events if network fails', async () => {
    mocks.sendEvents.mockRejectedValueOnce(new Error('offline'))
    const wrapper = mountHarness()

    for (let i = 0; i < IMMEDIATE_FLUSH_BATCH_SIZE; i++)
      enqueueProductEvent('word_saved_to_dict', { language: 'zh' })

    await Promise.resolve()
    await Promise.resolve()

    expect(mocks.sendEvents).toHaveBeenCalledTimes(1)
    // Restored after failure
    expect(getPendingProductEventsCount()).toBe(IMMEDIATE_FLUSH_BATCH_SIZE)

    // Succeeds on next interval
    await vi.advanceTimersByTimeAsync(15_000)
    expect(mocks.sendEvents).toHaveBeenCalledTimes(2)
    expect(getPendingProductEventsCount()).toBe(0)

    wrapper.unmount()
  })

  it('flushes with keepalive on visibility hidden / pagehide and clears queue on logout', async () => {
    const wrapper = mountHarness()

    enqueueProductEvent('deck_created', { language: 'en' })
    setVisibility('hidden')
    document.dispatchEvent(new Event('visibilitychange'))
    await Promise.resolve()

    expect(mocks.sendEvents).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({ event: 'deck_created' })]), { keepalive: true })

    setVisibility('visible')
    document.dispatchEvent(new Event('visibilitychange'))

    enqueueProductEvent('anki_export_downloaded')
    window.dispatchEvent(new Event('pagehide'))
    await Promise.resolve()

    expect(mocks.sendEvents).toHaveBeenLastCalledWith(expect.arrayContaining([expect.objectContaining({ event: 'anki_export_downloaded' })]), { keepalive: true })

    // Queue accumulated while offline is cleared on logout, and flushed on login
    mocks.network.effectiveOffline = true
    enqueueProductEvent('pwa_installed')
    await vi.advanceTimersByTimeAsync(15_000)
    expect(getPendingProductEventsCount()).toBe(1)

    mocks.auth.user = null
    await Promise.resolve()
    expect(getPendingProductEventsCount()).toBe(0)

    mocks.network.effectiveOffline = false
    enqueueProductEvent('login_success')
    mocks.auth.user = { id: 2, username: 'bob' }
    await Promise.resolve()
    expect(mocks.sendEvents).toHaveBeenLastCalledWith([expect.objectContaining({ event: 'login_success' })], { keepalive: undefined })

    wrapper.unmount()
  })
})
