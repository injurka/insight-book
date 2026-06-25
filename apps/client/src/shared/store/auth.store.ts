import type { UserData } from '../types/models'
import { useUmami } from '~/shared/composables/use-umami'
import { api } from '../services/api.service'

export const useAuthStore = defineStore('auth', () => {
  const { identifyUser, trackEvent } = useUmami()

  const user = ref<UserData | null>(null)

  const isSingleMode = ref(false)
  const isAuthReady = ref(false)

  async function checkAuth() {
    try {
      const res = await api.auth.me()

      user.value = res.user
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
    }
    catch {
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
    finally {
      isAuthReady.value = true
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
          const token = localStorage.getItem('insight_token')
          const BASE = import.meta.env.VITE_API_URL || 'https://insight-api.trip-scheduler.ru'
          await fetch(`${BASE}/api/push/unsubscribe`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ endpoint: sub.endpoint }),
          }).catch(() => { })
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
    const res = await api.auth.updateAvatar(file)
    if (user.value) {
      user.value.avatarUrl = res.avatarUrl
      localStorage.setItem('insight_user_data', JSON.stringify(user.value))
    }
  }

  async function updateUsername(username: string) {
    const res = await api.auth.updateUsername(username)
    if (user.value) {
      user.value.username = res.username
      localStorage.setItem('insight_user_data', JSON.stringify(user.value))
    }
  }

  return { user, isSingleMode, isAuthReady, checkAuth, logout, updateAvatar, updateUsername }
})
