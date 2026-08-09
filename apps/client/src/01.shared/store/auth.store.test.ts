import type { UserData } from '~/01.shared/types/models'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuthStore } from './auth.store'

const meMock = vi.fn()
const getMyPluginsMock = vi.fn()
const invalidateQueriesMock = vi.fn()

vi.mock('@pinia/colada', () => ({
  useQueryCache: () => ({
    invalidateQueries: invalidateQueriesMock,
  }),
}))

vi.mock('~/00.plugins/di', () => ({
  useRepos: () => ({
    auth: {
      me: meMock,
      updateAvatar: vi.fn(),
      updateUsername: vi.fn(),
    },
    plugin: {
      getMyPlugins: getMyPluginsMock,
    },
    push: {
      unsubscribeWeb: vi.fn(),
    },
  }),
}))

const identifyUserMock = vi.fn()
const trackEventMock = vi.fn()

vi.mock('~/01.shared/composables/use-tracking', () => ({
  useTracking: () => ({
    identifyUser: identifyUserMock,
    trackEvent: trackEventMock,
    trackPageview: vi.fn(),
  }),
}))

// Avoid real dynamic imports in loadUserPlugins when a user is present
vi.mock('~/01.shared/lib/router', () => ({ default: {} }))
vi.mock('~/00.plugins/plugin-manager', () => ({
  pluginManager: { loadRemotePlugin: vi.fn() },
}))

function makeUser(overrides: Partial<UserData> = {}): UserData {
  return {
    id: 1,
    username: 'tester',
    role: 'user',
    ...overrides,
  } as UserData
}

describe('authStore - checkAuth', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    vi.clearAllMocks()
    getMyPluginsMock.mockResolvedValue([])
  })

  it('logs the user in when a token exists and the server responds successfully', async () => {
    const user = makeUser()
    localStorage.setItem('insight_token', 'token-123')
    meMock.mockResolvedValue({ user, mode: 'multi' })

    const store = useAuthStore()
    await store.checkAuth()

    expect(meMock).toHaveBeenCalledTimes(1)
    expect(store.user).toEqual(user)
    expect(store.isSingleMode).toBe(false)
    expect(store.isAuthReady).toBe(true)
    expect(localStorage.getItem('insight_uid')).toBe(String(user.id))
    expect(localStorage.getItem('insight_user_data')).toBe(JSON.stringify(user))
    expect(localStorage.getItem('insight_auth_mode')).toBe('multi')
    expect(identifyUserMock).toHaveBeenCalledWith({
      id: String(user.id),
      username: user.username,
      role: 'user',
      auth_mode: 'multi',
    })
  })

  it('clears the token and user when the server returns no user', async () => {
    localStorage.setItem('insight_token', 'stale-token')
    localStorage.setItem('insight_uid', '1')
    localStorage.setItem('insight_user_data', JSON.stringify(makeUser()))
    meMock.mockResolvedValue({ user: null, mode: 'multi' })

    const store = useAuthStore()
    await store.checkAuth()

    expect(store.user).toBeNull()
    expect(store.isSingleMode).toBe(false)
    expect(store.isAuthReady).toBe(true)
    expect(localStorage.getItem('insight_token')).toBeNull()
    expect(localStorage.getItem('insight_uid')).toBeNull()
    expect(localStorage.getItem('insight_user_data')).toBeNull()
    expect(localStorage.getItem('insight_auth_mode')).toBe('multi')
  })

  it('falls back to the cached user when the server request fails but a token and cached user exist', async () => {
    const cachedUser = makeUser({ id: 7, username: 'cached' })
    localStorage.setItem('insight_token', 'token-123')
    localStorage.setItem('insight_user_data', JSON.stringify(cachedUser))
    localStorage.setItem('insight_auth_mode', 'multi')
    meMock.mockRejectedValue(new Error('Network Error'))

    const store = useAuthStore()
    await store.checkAuth()

    expect(store.user).toEqual(cachedUser)
    expect(store.isSingleMode).toBe(false)
    expect(store.isAuthReady).toBe(true)
    expect(identifyUserMock).toHaveBeenCalledWith({
      id: String(cachedUser.id),
      username: cachedUser.username,
      role: 'user',
      auth_mode: 'multi',
    })
  })

  it('logs the user out when the server request fails and there is no cached user', async () => {
    localStorage.setItem('insight_token', 'token-123')
    meMock.mockRejectedValue(new Error('401 Unauthorized'))

    const store = useAuthStore()
    await store.checkAuth()

    expect(store.user).toBeNull()
    expect(store.isAuthReady).toBe(true)
    expect(identifyUserMock).not.toHaveBeenCalled()
  })

  it('logs the user out on 401 even when a cached user exists', async () => {
    const cachedUser = makeUser({ id: 7, username: 'cached' })
    localStorage.setItem('insight_token', 'token-123')
    localStorage.setItem('insight_user_data', JSON.stringify(cachedUser))
    const unauthorized = Object.assign(new Error('Unauthorized'), { status: 401 })
    meMock.mockRejectedValue(unauthorized)

    const store = useAuthStore()
    await store.checkAuth()

    expect(store.user).toBeNull()
    expect(localStorage.getItem('insight_token')).toBeNull()
    expect(localStorage.getItem('insight_user_data')).toBeNull()
    expect(identifyUserMock).not.toHaveBeenCalled()
  })

  it('does not call the server when there is no token and the cached mode is multi', async () => {
    localStorage.setItem('insight_auth_mode', 'multi')

    const store = useAuthStore()
    await store.checkAuth()

    expect(meMock).not.toHaveBeenCalled()
    expect(store.user).toBeNull()
    expect(store.isSingleMode).toBe(false)
    expect(store.isAuthReady).toBe(true)
  })

  it('still calls the server when there is no token but no cached multi mode (single-mode deployments)', async () => {
    meMock.mockResolvedValue({ user: null, mode: 'single' })

    const store = useAuthStore()
    await store.checkAuth()

    expect(meMock).toHaveBeenCalledTimes(1)
    expect(store.isSingleMode).toBe(true)
    expect(store.user).toBeNull()
  })
})

describe('authStore - isSingleMode', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    vi.clearAllMocks()
    getMyPluginsMock.mockResolvedValue([])
  })

  it('is set to true when the server responds with single mode', async () => {
    const user = makeUser()
    localStorage.setItem('insight_token', 'token-123')
    meMock.mockResolvedValue({ user, mode: 'single' })

    const store = useAuthStore()
    await store.checkAuth()

    expect(store.isSingleMode).toBe(true)
    expect(localStorage.getItem('insight_auth_mode')).toBe('single')
    expect(identifyUserMock).toHaveBeenCalledWith(expect.objectContaining({ auth_mode: 'single' }))
  })

  it('is restored from the cached mode when the server request fails', async () => {
    const cachedUser = makeUser()
    localStorage.setItem('insight_user_data', JSON.stringify(cachedUser))
    localStorage.setItem('insight_auth_mode', 'single')
    meMock.mockRejectedValue(new Error('Network Error'))

    const store = useAuthStore()
    await store.checkAuth()

    // No token, but single mode allows restoring the cached user
    expect(store.isSingleMode).toBe(true)
    expect(store.user).toEqual(cachedUser)
    expect(identifyUserMock).toHaveBeenCalledWith(expect.objectContaining({ auth_mode: 'single' }))
  })

  it('does not restore the cached user on failure when there is no token and mode is not single', async () => {
    localStorage.setItem('insight_user_data', JSON.stringify(makeUser()))
    localStorage.setItem('insight_auth_mode', 'multi')
    meMock.mockRejectedValue(new Error('Network Error'))

    const store = useAuthStore()
    await store.checkAuth()

    expect(store.isSingleMode).toBe(false)
    expect(store.user).toBeNull()
  })
})

describe('authStore - cache invalidation', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    vi.clearAllMocks()
    getMyPluginsMock.mockResolvedValue([])
  })

  it('invalidates books query cache after successful user authentication', async () => {
    const user = makeUser()
    localStorage.setItem('insight_token', 'token-123')
    meMock.mockResolvedValue({ user, mode: 'multi' })

    const store = useAuthStore()
    await store.checkAuth()

    expect(invalidateQueriesMock).toHaveBeenCalledWith({ key: ['books'] })
  })

  it('invalidates books query cache on logout', async () => {
    const store = useAuthStore()
    await store.logout()

    expect(invalidateQueriesMock).toHaveBeenCalledWith({ key: ['books'] })
  })
})
