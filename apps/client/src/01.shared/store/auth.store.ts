import type { UserData } from '../types/models'
import { useQueryCache } from '@pinia/colada'
import { useRepos } from '~/00.plugins/di'
import { useTracking } from '~/01.shared/composables/use-tracking'
import { queryKeys } from '~/01.shared/lib/query-keys'
import { resetTelemetryUser } from '~/01.shared/services/monitoring.service'
import { UserDataSchema } from '~/01.shared/types/schemas/auth.schema'

function toErrorStatus(value: unknown): number | null {
  if (value === null || value === undefined)
    return null

  const status = typeof value === 'number' ? value : Number(value)

  return Number.isFinite(status) ? status : null
}

function getErrorStatus(error: unknown): number | null {
  if (!error || typeof error !== 'object')
    return null

  const errObj = error as Record<string, unknown> | null | undefined
  const responseObj = errObj?.response as Record<string, unknown> | null | undefined

  return toErrorStatus(errObj?.status)
    ?? toErrorStatus(errObj?.statusCode)
    ?? toErrorStatus(responseObj?.status)
}

function isInvalidSessionError(error: unknown): boolean {
  const errObj = error as Record<string, unknown> | null | undefined
  const code = typeof errObj?.code === 'string' ? errObj.code : null

  return getErrorStatus(error) === 401 || code === 'INVALID_TOKEN' || code === 'USER_NOT_FOUND'
}

export const useAuthStore = defineStore('auth', () => {
  const repos = useRepos()
  const { identifyUser, trackEvent } = useTracking()
  const queryCache = useQueryCache()

  const user = ref<UserData | null>(null)

  const isSingleMode = ref(false)
  const isAuthReady = ref(false)
  const isAuthRefreshing = ref(false)
  let authRefreshPromise: Promise<void> | null = null

  /**
   * Synchronous init from localStorage cache.
   * Sets isAuthReady = true immediately — the app can render with cached auth state.
   * Background API refresh happens later via checkAuth().
   */
  function init() {
    loadCachedUserSession()
    isAuthReady.value = true
  }

  /**
   * Background auth refresh. Fires API call to sync user data.
   * Sets isAuthReady = true in finally for callers that skip init() (tests, storybook).
   * In production, init() already set isAuthReady before mount — this runs purely as refresh.
   */
  function checkAuth(): Promise<void> {
    if (authRefreshPromise)
      return authRefreshPromise

    const refreshPromise = (async () => {
      isAuthRefreshing.value = true
      try {
        await syncUser()
      }
      finally {
        isAuthRefreshing.value = false
        isAuthReady.value = true
        if (user.value)
          loadUserPlugins().catch(err => console.warn('[Auth Store] Error loading plugins:', err))
      }
    })()

    authRefreshPromise = refreshPromise
    void refreshPromise.then(() => {
      if (authRefreshPromise === refreshPromise)
        authRefreshPromise = null
    }, () => {
      if (authRefreshPromise === refreshPromise)
        authRefreshPromise = null
    })

    return refreshPromise
  }

  function clearCachedUserSession() {
    localStorage.removeItem('insight_token')
    localStorage.removeItem('insight_uid')
    localStorage.removeItem('insight_user_data')
    user.value = null
    queryCache.invalidateQueries({ key: queryKeys.books.all })
  }

  function loadCachedUserSession() {
    const cachedToken = localStorage.getItem('insight_token')
    const cachedMode = localStorage.getItem('insight_auth_mode')
    const cachedUserJson = localStorage.getItem('insight_user_data')
    let cachedUser: UserData | null = null

    if (cachedUserJson) {
      try {
        const parsed = UserDataSchema.safeParse(JSON.parse(cachedUserJson) as unknown)
        if (parsed.success) {
          cachedUser = parsed.data
        }
        else {
          throw new Error('cached user schema mismatch')
        }
      }
      catch (error) {
        console.warn('[Auth Store] Ignoring corrupted cached user session:', error)
        localStorage.removeItem('insight_user_data')
      }
    }

    if (cachedMode)
      isSingleMode.value = cachedMode === 'single'

    if ((cachedToken || isSingleMode.value) && cachedUser) {
      user.value = cachedUser

      identifyUser({
        id: String(user.value!.id),
        username: user.value!.username,
        role: user.value!.role || 'user',
        auth_mode: isSingleMode.value ? 'single' : 'multi',
      })

      queryCache.invalidateQueries({ key: queryKeys.books.all })
    }
    else {
      user.value = null
    }
  }

  function handleSyncError(error: unknown) {
    if (isInvalidSessionError(error)) {
      clearCachedUserSession()

      return
    }

    loadCachedUserSession()
  }

  async function syncUser() {
    const token = localStorage.getItem('insight_token')
    const cachedMode = localStorage.getItem('insight_auth_mode')

    if (!token && cachedMode === 'multi') {
      isSingleMode.value = false
      user.value = null

      return
    }

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      loadCachedUserSession()

      return
    }

    try {
      const res = await repos.auth.me()

      user.value = res.user || null
      isSingleMode.value = res.mode === 'single'

      if (res.user) {
        localStorage.setItem('insight_uid', String(res.user.id))
        localStorage.setItem('insight_user_data', JSON.stringify(res.user))
        localStorage.setItem('insight_auth_mode', res.mode)

        identifyUser({
          id: String(user.value!.id),
          username: user.value!.username,
          role: user.value!.role || 'user',
          auth_mode: isSingleMode.value ? 'single' : 'multi',
        })

        queryCache.invalidateQueries({ key: queryKeys.books.all })
      }
      else {
        localStorage.setItem('insight_auth_mode', res.mode)
        localStorage.removeItem('insight_token')
        localStorage.removeItem('insight_uid')
        localStorage.removeItem('insight_user_data')
        queryCache.invalidateQueries({ key: queryKeys.books.all })
      }
    }
    catch (e) {
      handleSyncError(e)
    }
  }

  async function loadUserPlugins() {
    if (!user.value)
      return

    if (typeof navigator !== 'undefined' && !navigator.onLine)
      return

    try {
      const userPlugins = await repos.plugin.getMyPlugins()
      const router = (await import('~/01.shared/lib/router')).default
      const { pluginManager } = await import('~/00.plugins/plugin-manager')

      for (const pluginRecord of userPlugins) {
        if (pluginRecord.isEnabled && pluginRecord.manifestUrl)
          await pluginManager.loadRemotePlugin(pluginRecord.manifestUrl, router)
      }
    }
    catch (e) {
      console.warn('[Auth Store] Failed to load user plugins:', e)
    }
  }

  async function logout() {
    trackEvent('logout')

    // Отписываемся от Push перед выходом, чтобы пуши не приходили на чужой ПК
    try {
      const { usePwaStore } = await import('~/01.shared/store/pwa.store')
      const pwaStore = usePwaStore()
      if (pwaStore.isPushSubscribed && 'serviceWorker' in navigator && 'PushManager' in window) {
        const reg = await navigator.serviceWorker.ready
        const sub = await reg.pushManager.getSubscription()
        if (sub) {
          await sub.unsubscribe()
          await repos.push.unsubscribeWeb(sub.endpoint).catch(() => { })
        }
      }
    }
    catch (e) {
      console.warn('Failed to unsubscribe on logout', e)
    }

    localStorage.removeItem('insight_token')
    localStorage.removeItem('insight_uid')
    localStorage.removeItem('insight_user_data')
    localStorage.removeItem('insight_auth_mode')

    user.value = null
    queryCache.invalidateQueries({ key: queryKeys.books.all })
    resetTelemetryUser()
  }

  async function updateAvatar(file: File) {
    const res = await repos.auth.updateAvatar(file)
    if (user.value) {
      user.value.avatarUrl = res.avatarUrl
      localStorage.setItem('insight_user_data', JSON.stringify(user.value))
    }
  }

  async function updateUsername(username: string) {
    const res = await repos.auth.updateUsername(username)
    if (user.value) {
      user.value.username = res.username
      localStorage.setItem('insight_user_data', JSON.stringify(user.value))
    }
  }

  async function unlinkProvider(provider: string) {
    const res = await repos.auth.unlinkProvider(provider)
    if (res.user) {
      user.value = res.user
      localStorage.setItem('insight_user_data', JSON.stringify(user.value))
    }

    return res
  }

  return {
    user,
    isSingleMode,
    isAuthReady,
    isAuthRefreshing,
    init,
    checkAuth,
    logout,
    updateAvatar,
    updateUsername,
    unlinkProvider,
  }
})
