import type { Pinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'

const mocks = vi.hoisted(() => ({
  useRegisterSW: vi.fn(),
  routerPush: vi.fn(),
  pwaStore: {
    setOfflineReady: vi.fn(),
    setNeedRefresh: vi.fn(),
    setUpdateFunction: vi.fn(),
  },
  analysisStore: {
    isPageAnalysisModalOpen: true,
    addEditWordModalOpen: true,
  },
  useAnalysisStore: vi.fn(),
}))

vi.mock('virtual:pwa-register/vue', () => ({
  useRegisterSW: mocks.useRegisterSW,
}))

vi.mock('~/01.shared/lib/router', () => ({
  default: { push: mocks.routerPush },
}))

vi.mock('~/01.shared/store/pwa.store', () => ({
  usePwaStore: () => mocks.pwaStore,
}))

vi.mock('~/01.shared/store/analysis/analysis.store', () => ({
  useAnalysisStore: mocks.useAnalysisStore,
}))

const fakePinia = {} as Pinia

describe('pwa service', () => {
  const originalServiceWorker = navigator.serviceWorker

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    mocks.analysisStore.isPageAnalysisModalOpen = true
    mocks.analysisStore.addEditWordModalOpen = true
    mocks.useAnalysisStore.mockReturnValue(mocks.analysisStore)
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.useRealTimers()
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: originalServiceWorker,
    })
  })

  it('does nothing in DEV mode', async () => {
    vi.stubEnv('DEV', true)
    const { initializePwaUpdater } = await import('./pwa.service')

    initializePwaUpdater(fakePinia)

    expect(mocks.useRegisterSW).not.toHaveBeenCalled()
  })

  it('wires service worker state, periodic updates, error logging, and NAVIGATE messages in production', async () => {
    vi.stubEnv('DEV', false)
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const offlineReady = ref(false)
    const needRefresh = ref(false)
    const updateServiceWorker = vi.fn()
    let registeredCb: ((reg?: ServiceWorkerRegistration) => void) | undefined
    let registerErrorCb: ((err: unknown) => void) | undefined

    mocks.useRegisterSW.mockImplementation((opts: {
      onRegistered?: (reg?: ServiceWorkerRegistration) => void
      onRegisterError?: (err: unknown) => void
    }) => {
      registeredCb = opts.onRegistered
      registerErrorCb = opts.onRegisterError

      return { offlineReady, needRefresh, updateServiceWorker }
    })

    let messageHandler: ((event: MessageEvent) => Promise<void>) | undefined
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: {
        addEventListener: vi.fn((type: string, handler: (event: MessageEvent) => Promise<void>) => {
          if (type === 'message')
            messageHandler = handler
        }),
      },
    })

    const { initializePwaUpdater } = await import('./pwa.service')
    initializePwaUpdater(fakePinia)

    expect(mocks.pwaStore.setOfflineReady).toHaveBeenCalledWith(false)
    expect(mocks.pwaStore.setNeedRefresh).toHaveBeenCalledWith(false)
    expect(mocks.pwaStore.setUpdateFunction).toHaveBeenCalledWith(updateServiceWorker)

    offlineReady.value = true
    needRefresh.value = true
    await nextTick()

    expect(mocks.pwaStore.setOfflineReady).toHaveBeenLastCalledWith(true)
    expect(mocks.pwaStore.setNeedRefresh).toHaveBeenLastCalledWith(true)

    // Test registration error handler
    registerErrorCb?.(new Error('sw failed'))
    expect(errorSpy).toHaveBeenCalledWith('Error during Service Worker registration:', expect.any(Error))

    // Test periodic SW update check
    const updateMock = vi.fn().mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('network'))
    const registration = {
      installing: null as ServiceWorker | null,
      update: updateMock,
    } as unknown as ServiceWorkerRegistration
    registeredCb?.(registration)

    await vi.advanceTimersByTimeAsync(10 * 60 * 1000)
    expect(updateMock).toHaveBeenCalledTimes(1)

    // Skip when installing
    Object.defineProperty(registration, 'installing', { configurable: true, value: {} })
    await vi.advanceTimersByTimeAsync(10 * 60 * 1000)
    expect(updateMock).toHaveBeenCalledTimes(1)

    // Skip when offline
    Object.defineProperty(registration, 'installing', { configurable: true, value: null })
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false })
    await vi.advanceTimersByTimeAsync(10 * 60 * 1000)
    expect(updateMock).toHaveBeenCalledTimes(1)

    // Handle rejected update gracefully
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true })
    await vi.advanceTimersByTimeAsync(10 * 60 * 1000)
    expect(updateMock).toHaveBeenCalledTimes(2)
    expect(warnSpy).toHaveBeenCalledWith('SW update check failed:', expect.any(Error))

    // Test NAVIGATE message closes analysis modals and navigates
    await messageHandler?.({ data: { type: 'OTHER', url: '/ignored' } } as MessageEvent)
    expect(mocks.routerPush).not.toHaveBeenCalled()

    await messageHandler?.({ data: { type: 'NAVIGATE', url: '/reader/5' } } as MessageEvent)
    expect(mocks.analysisStore.isPageAnalysisModalOpen).toBe(false)
    expect(mocks.analysisStore.addEditWordModalOpen).toBe(false)
    expect(mocks.routerPush).toHaveBeenCalledWith('/reader/5')

    // Still navigates if closing modals fails
    mocks.useAnalysisStore.mockImplementationOnce(() => {
      throw new Error('store unavailable')
    })
    await messageHandler?.({ data: { type: 'NAVIGATE', url: '/dictionary' } } as MessageEvent)
    expect(warnSpy).toHaveBeenCalledWith('Failed to close global modals before navigation:', expect.any(Error))
    expect(mocks.routerPush).toHaveBeenCalledWith('/dictionary')

    logSpy.mockRestore()
    warnSpy.mockRestore()
    errorSpy.mockRestore()
  })
})
