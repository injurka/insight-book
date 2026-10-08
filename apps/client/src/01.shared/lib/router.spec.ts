import type { RouteLocationNormalized, RouterOptions } from 'vue-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AppRouteNames } from '~/01.shared/constants/routes'

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  before: vi.fn(),
  after: vi.fn(),
  web: vi.fn(),
  hash: vi.fn(),
  auth: {
    isAuthReady: true,
    isAuthRefreshing: false,
    user: null as object | null,
    isSingleMode: false,
    checkAuth: vi.fn(),
  },
  env: { isTauri: false, getApiEndpointUrl: vi.fn() },
  pageview: vi.fn(),
}))
vi.mock('vue-router', () => ({ createRouter: mocks.create, createWebHistory: mocks.web, createWebHashHistory: mocks.hash }))
vi.mock('~/01.shared/store/auth.store', () => ({ useAuthStore: () => mocks.auth }))
vi.mock('./env', () => mocks.env)
vi.mock('~/01.shared/composables/use-tracking', () => ({ useTracking: () => ({ trackPageview: mocks.pageview }) }))

function route(name: AppRouteNames | undefined, path = '/', query = {}): RouteLocationNormalized {
  return {
    name,
    path,
    fullPath: path,
    query,
    hash: '',
    params: {},
    matched: [],
    meta: {},
    redirectedFrom: undefined,
  }
}
async function setup() {
  const module = await import('./router')
  const options = mocks.create.mock.lastCall![0] as RouterOptions

  return {
    ...module,
    options,
    save: mocks.before.mock.calls[0][0] as (to: RouteLocationNormalized, from: RouteLocationNormalized) => void,
    guard: mocks.before.mock.calls[1][0] as (to: RouteLocationNormalized, from: RouteLocationNormalized) => Promise<unknown>,
    after: mocks.after.mock.calls[0][0] as (to: RouteLocationNormalized, from: RouteLocationNormalized, failure?: Error) => void,
  }
}

let frames: FrameRequestCallback[]
beforeEach(() => {
  vi.resetModules()
  vi.clearAllMocks()
  mocks.create.mockReturnValue({ beforeEach: mocks.before, afterEach: mocks.after })
  Object.assign(mocks.auth, { isAuthReady: true, isAuthRefreshing: false, user: null, isSingleMode: false })
  mocks.env.isTauri = false
  mocks.env.getApiEndpointUrl.mockReturnValue('https://api.example.com/api/auth/yandex/callback')
  localStorage.clear()
  localStorage.setItem('insight_onboarding_completed', 'true')
  document.body.innerHTML = '<main class="main-content"></main>'
  frames = []
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    frames.push(callback)

    return frames.length
  })
})
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
})

describe('router guards', () => {
  it('uses web history normally and hash history in Tauri', async () => {
    await setup()
    expect(mocks.web).toHaveBeenCalledOnce()
    vi.resetModules()
    mocks.env.isTauri = true
    await setup()
    expect(mocks.hash).toHaveBeenCalledOnce()
  })
  it('waits for auth on protected routes and redirects unauthenticated users', async () => {
    const { guard } = await setup()
    mocks.auth.isAuthRefreshing = true
    expect(await guard(route(AppRouteNames.Reader), route(AppRouteNames.Home))).toEqual({ name: AppRouteNames.SignIn })
    expect(mocks.auth.checkAuth).toHaveBeenCalledOnce()
    mocks.auth.isSingleMode = true
    expect(await guard(route(AppRouteNames.Reader), route(AppRouteNames.Home))).toBeUndefined()
    mocks.auth.user = { id: 1 }
    expect(await guard(route(AppRouteNames.SignIn), route(AppRouteNames.Home))).toEqual({ name: AppRouteNames.Home })
  })
  it('allows public navigation without waiting for background auth', async () => {
    const { guard } = await setup()
    mocks.auth.isAuthRefreshing = true
    expect(await guard(route(AppRouteNames.About), route(AppRouteNames.Home))).toBeUndefined()
    expect(mocks.auth.checkAuth).not.toHaveBeenCalled()
    mocks.auth.isAuthReady = false
    await guard(route(AppRouteNames.About), route(AppRouteNames.Home))
    expect(mocks.auth.checkAuth).toHaveBeenCalledOnce()
  })
  it('shows onboarding once while allowing login and callback routes', async () => {
    const { guard } = await setup()
    localStorage.removeItem('insight_onboarding_completed')
    expect(await guard(route(AppRouteNames.Home), route(undefined))).toEqual({ name: AppRouteNames.Onboarding })

    for (const name of [AppRouteNames.Onboarding, AppRouteNames.SignIn, AppRouteNames.YandexCallback])
      expect(await guard(route(name), route(undefined))).toBeUndefined()
  })
  it('restores saved query only for the initial empty home route', async () => {
    const { guard } = await setup()
    const query = { search: 'book', tags: ['a', null] }
    localStorage.setItem('library_last_view_query', JSON.stringify(query))
    expect(await guard(route(AppRouteNames.Home), route(undefined))).toEqual({ name: AppRouteNames.Home, query, replace: true })
    expect(await guard(route(AppRouteNames.Home, '/', { search: 'new' }), route(undefined))).toBeUndefined()
    expect(await guard(route(AppRouteNames.Home), route(AppRouteNames.About))).toBeUndefined()
  })
  it.each(['null', '[]', '"query"', '{"x":{}}', '{"x":1}', '{}', 'invalid'])('ignores invalid saved query %s', async (value) => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { guard } = await setup()
    localStorage.setItem('library_last_view_query', value)
    expect(await guard(route(AppRouteNames.Home), route(undefined))).toBeUndefined()
  })
  it('works when storage is denied and does not track failed navigation', async () => {
    const { guard, after } = await setup()
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('denied')
      },
      setItem: () => {
        throw new Error('denied')
      },
    })
    expect(await guard(route(AppRouteNames.Home), route(undefined))).toEqual({ name: AppRouteNames.Onboarding })
    expect(() => after(route(AppRouteNames.Home), route(undefined))).not.toThrow()
    expect(mocks.pageview).toHaveBeenCalledOnce()
    after(route(AppRouteNames.Home), route(undefined), new Error('cancelled'))
    expect(mocks.pageview).toHaveBeenCalledOnce()
  })
  it('saves home filters and reports successful page views', async () => {
    const { after } = await setup()
    after(route(AppRouteNames.Home, '/', { search: 'book' }), route(undefined))
    expect(JSON.parse(localStorage.getItem('library_last_view_query')!)).toEqual({ search: 'book' })
    expect(mocks.pageview).toHaveBeenCalledWith('/', AppRouteNames.Home)
  })
  it('forwards misplaced OAuth callbacks and prevents same-origin loops', async () => {
    const { options } = await setup()
    const callback = options.routes.find(item => item.name === 'YandexApiCallbackProxy')!.beforeEnter
    expect(typeof callback).toBe('function')
    const guard = callback as (to: RouteLocationNormalized) => unknown
    const replace = vi.spyOn(window.location, 'replace').mockImplementation(() => {})
    expect(guard(route(undefined, '/api/auth/yandex/callback?code=123'))).toBe(false)
    expect(replace).toHaveBeenCalledWith('https://api.example.com/api/auth/yandex/callback')
    mocks.env.getApiEndpointUrl.mockReturnValue(`${window.location.origin}/api/auth/yandex/callback`)
    expect(guard(route(undefined))).toEqual({ name: AppRouteNames.YandexCallback, query: { oauth_error: 'api_unavailable' } })
  })
})

describe('main container scroll', () => {
  it('defers resetting scroll until the page transition finishes', async () => {
    const { options, applyPendingMainScroll } = await setup()
    const element = document.querySelector<HTMLElement>('.main-content')!
    element.scrollTop = 200
    await options.scrollBehavior!(route(AppRouteNames.About, '/about'), route(AppRouteNames.Home), null)
    expect(element.scrollTop).toBe(200)
    applyPendingMainScroll()
    expect(element.scrollTop).toBe(0)
    applyPendingMainScroll()
    expect(element.scrollTop).toBe(0)
  })
  it('restores home scroll after book details and saved back navigation', async () => {
    const { save, options, applyPendingMainScroll } = await setup()
    const element = document.querySelector<HTMLElement>('.main-content')!
    const home = route(AppRouteNames.Home)
    const book = route(AppRouteNames.BookInfo, '/book/1')
    element.scrollTop = 240
    save(book, home)
    element.scrollTop = 0
    await options.scrollBehavior!(home, book, null)
    applyPendingMainScroll()
    expect(element.scrollTop).toBe(240)
    element.scrollTop = 0
    await options.scrollBehavior!(home, route(AppRouteNames.About, '/about'), { top: 0, left: 0 })
    applyPendingMainScroll()
    expect(element.scrollTop).toBe(240)
  })
  it('immediately resets query-only navigation and cancels older frame retries', async () => {
    const { save, options } = await setup()
    const element = document.querySelector<HTMLElement>('.main-content')!
    let top = 10
    Object.defineProperty(element, 'scrollTop', { configurable: true, get: () => top, set: () => {} })
    await options.scrollBehavior!(route(AppRouteNames.Home), route(AppRouteNames.Home), null)
    expect(frames.length).toBe(1)
    save(route(AppRouteNames.About), route(AppRouteNames.Home))
    top = 100
    frames.shift()!(0)
    expect(frames.length).toBe(0)
    expect(top).toBe(100)
  })
  it('retries when the scroller is not mounted yet and stops after 30 frames', async () => {
    const { options } = await setup()
    document.body.innerHTML = ''
    await options.scrollBehavior!(route(AppRouteNames.Home), route(AppRouteNames.Home), null)
    expect(frames.length).toBe(1)

    for (let i = 0; i < 40 && frames.length; i++)
      frames.shift()!(0)

    expect(frames).toHaveLength(0)
  })
})
