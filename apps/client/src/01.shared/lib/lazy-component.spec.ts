import type { AsyncComponentOptions, Component } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { lazyComponent } from './lazy-component'

const mocks = vi.hoisted(() => ({ define: vi.fn(), toast: { error: vi.fn() } }))
vi.mock('vue', async original => ({ ...await original<typeof import('vue')>(), defineAsyncComponent: mocks.define }))
vi.mock('~/01.shared/store/toast.store', () => ({ useToastStore: () => mocks.toast }))

function options(loader = async (): Promise<Component> => ({ template: '<div />' }), config = {}) {
  lazyComponent(loader, config)

  return mocks.define.mock.lastCall![0] as AsyncComponentOptions
}

beforeEach(() => {
  vi.useFakeTimers()
  mocks.define.mockClear()
  mocks.toast.error.mockClear()
  sessionStorage.clear()
})
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('lazyComponent', () => {
  it('passes timing options and enables the loader only when requested', () => {
    const defaults = options()
    expect(defaults.delay).toBe(300)
    expect(defaults.timeout).toBe(10000)
    expect(defaults.loadingComponent).toBeUndefined()
    const loadingComponent = { template: '<div>Loading</div>' }
    const custom = options(undefined, { loadingComponent, delay: 50, timeout: 500 })
    expect(custom.delay).toBe(50)
    expect(custom.timeout).toBe(500)
    expect(custom.loadingComponent).toBe(loadingComponent)
  })
  it('returns the loaded component without resetting another failed chunk reload budget', async () => {
    const component = { template: '<div />' }
    sessionStorage.setItem('chunk_reload_count', '2')
    expect(await options(async () => component).loader()).toBe(component)
    expect(sessionStorage.getItem('chunk_reload_count')).toBe('2')
  })

  it('allows recovery after the reload window has expired', () => {
    vi.setSystemTime(120_000)
    sessionStorage.setItem('chunk_reload_count', '2')
    sessionStorage.setItem('chunk_reload_time', '1')
    const reload = vi.spyOn(window.location, 'reload').mockImplementation(() => {})
    options().onError!(
      new Error('fetch dynamically imported module'),
      vi.fn(),
      vi.fn(),
      1,
    )
    expect(reload).toHaveBeenCalledOnce()
    expect(sessionStorage.getItem('chunk_reload_count')).toBe('1')
  })

  it.each(['Failed to fetch dynamically imported module', 'Importing a module script failed'])('reloads a stale chunk for %s, with a finite budget', (message) => {
    const reload = vi.spyOn(window.location, 'reload').mockImplementation(() => {})
    const config = options()
    const retry = vi.fn()
    const fail = vi.fn()
    config.onError!(
      new Error(message),
      retry,
      fail,
      1,
    )
    config.onError!(
      new Error(message),
      retry,
      fail,
      1,
    )
    expect(reload).toHaveBeenCalledTimes(2)
    expect(sessionStorage.getItem('chunk_reload_count')).toBe('2')
    config.onError!(
      new Error(message),
      retry,
      fail,
      4,
    )
    expect(reload).toHaveBeenCalledTimes(2)
    expect(fail).toHaveBeenCalledOnce()
    expect(mocks.toast.error).toHaveBeenCalledOnce()
  })
  it('recovers a malformed budget and falls back to retries when storage fails', async () => {
    const reload = vi.spyOn(window.location, 'reload').mockImplementation(() => {})
    sessionStorage.setItem('chunk_reload_count', 'broken')
    const config = options()
    const retry = vi.fn()
    config.onError!(
      new Error('fetch dynamically imported module'),
      retry,
      vi.fn(),
      1,
    )
    expect(reload).toHaveBeenCalledOnce()
    vi.stubGlobal('sessionStorage', {
      getItem: () => {
        throw new Error('denied')
      },
    })
    config.onError!(
      new Error('fetch dynamically imported module'),
      retry,
      vi.fn(),
      1,
    )
    await vi.advanceTimersByTimeAsync(1000)
    expect(retry).toHaveBeenCalledOnce()
  })
  it('delays retry for ordinary errors and fails after the retry limit', async () => {
    const config = options()
    const retry = vi.fn()
    const fail = vi.fn()
    config.onError!(
      new Error('network'),
      retry,
      fail,
      3,
    )
    await vi.advanceTimersByTimeAsync(999)
    expect(retry).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(retry).toHaveBeenCalledOnce()
    config.onError!(
      new Error('network'),
      retry,
      fail,
      4,
    )
    expect(fail).toHaveBeenCalledOnce()
  })
})
