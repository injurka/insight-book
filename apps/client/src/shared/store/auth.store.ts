import type { UserData } from '../types/models'
import { useUmami } from '~/shared/composables/use-umami'
import { useRepos } from '~/shared/plugins/di'

export const useAuthStore = defineStore('auth', () => {
  const repos = useRepos()
  const { identifyUser, trackEvent } = useUmami()

  const user = ref<UserData | null>(null)

  const isSingleMode = ref(false)
  const isAuthReady = ref(false)

  async function checkAuth() {
    try {
      await syncUser()
    }
    finally {
      isAuthReady.value = true
      if (user.value) {
        loadUserPlugins().catch(err => console.warn('[Auth Store] Error loading plugins:', err))
      }
    }
  }

  async function syncUser() {
    const token = localStorage.getItem('insight_token')
    const cachedMode = localStorage.getItem('insight_auth_mode')

    if (!token && cachedMode === 'multi') {
      isSingleMode.value = false
      user.value = null
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
      }
      else {
        localStorage.setItem('insight_auth_mode', res.mode)
        localStorage.removeItem('insight_token')
        localStorage.removeItem('insight_uid')
        localStorage.removeItem('insight_user_data')
      }
    }
    catch (e: any) {
      // 401 означает протухший/невалидный токен — разлогиниваем, а не живём на кэше
      const status = e?.status ?? e?.statusCode ?? e?.response?.status

      if (status === 401) {
        localStorage.removeItem('insight_token')
        localStorage.removeItem('insight_uid')
        localStorage.removeItem('insight_user_data')
        user.value = null

        return
      }

      const token = localStorage.getItem('insight_token')
      const cachedUser = localStorage.getItem('insight_user_data')
      const cachedMode = localStorage.getItem('insight_auth_mode')

      if (cachedMode) {
        isSingleMode.value = cachedMode === 'single'
      }

      if ((token || isSingleMode.value) && cachedUser) {
        user.value = JSON.parse(cachedUser)

        identifyUser({
          id: String(user.value!.id),
          username: user.value!.username,
          role: user.value!.role || 'user',
          auth_mode: isSingleMode.value ? 'single' : 'multi',
        })
      }
      else {
        user.value = null
      }
    }
  }

  async function loadUserPlugins() {
    if (!user.value)
      return

    try {
      const userPlugins = await repos.plugin.getMyPlugins()
      const router = (await import('~/shared/lib/router')).default
      const { pluginManager } = await import('~/shared/plugins/plugin-manager')

      for (const pluginRecord of userPlugins) {
        if (pluginRecord.isEnabled && pluginRecord.manifestUrl) {
          await pluginManager.loadRemotePlugin(pluginRecord.manifestUrl, router)
        }
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
      const { usePwaStore } = await import('~/shared/store/pwa.store')
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

  return {
    user,
    isSingleMode,
    isAuthReady,
    checkAuth,
    logout,
    updateAvatar,
    updateUsername,
  }
})
