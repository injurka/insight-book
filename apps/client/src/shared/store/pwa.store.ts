import { defineStore } from 'pinia'
import { useAuthStore } from './auth.store'

type UpdateServiceWorkerFunction = (reloadPage?: boolean) => Promise<void>

export interface PwaState {
  offlineReady: boolean
  needRefresh: boolean
  updateServiceWorker: UpdateServiceWorkerFunction | null
  isPushSubscribed: boolean
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

export const usePwaStore = defineStore('pwa', {
  state: (): PwaState => ({
    offlineReady: false,
    needRefresh: false,
    updateServiceWorker: null,
    isPushSubscribed: false,
  }),

  actions: {
    setOfflineReady(value: boolean) {
      this.offlineReady = value
    },

    setNeedRefresh(value: boolean) {
      this.needRefresh = value
    },

    setUpdateFunction(updateFn: UpdateServiceWorkerFunction) {
      this.updateServiceWorker = updateFn
    },

    async triggerUpdate() {
      if (this.updateServiceWorker) {
        await this.updateServiceWorker(true)
      }
      this.needRefresh = false
    },

    closePrompt() {
      this.offlineReady = false
      this.needRefresh = false
    },

    async checkPushStatus() {
      if (!('serviceWorker' in navigator) || !('PushManager' in window))
        return
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      this.isPushSubscribed = !!sub
    },

    async togglePushSubscription() {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        throw new Error('Push уведомления не поддерживаются в этом браузере или устройство не добавлено на главный экран (iOS)')
      }

      const BASE = import.meta.env.VITE_API_URL || 'https://insight-api.trip-scheduler.ru'
      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('insight_token')}`,
      }

      const reg = await navigator.serviceWorker.ready
      let sub = await reg.pushManager.getSubscription()

      if (sub) {
        await sub.unsubscribe()
        await fetch(`${BASE}/api/push/unsubscribe`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ endpoint: sub.endpoint }),
        })
        this.isPushSubscribed = false
      }
      else {
        const res = await fetch(`${BASE}/api/push/vapid-public-key`, { headers })
        const { publicKey } = await res.json()

        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        })

        await fetch(`${BASE}/api/push/subscribe`, {
          method: 'POST',
          headers,
          body: JSON.stringify(sub),
        })

        this.isPushSubscribed = true
      }
    },

    async updatePushSettings(settings: { deckId: number | 'all', timeStart: string, timeEnd: string }) {
      const BASE = import.meta.env.VITE_API_URL || 'https://insight-api.trip-scheduler.ru'

      // Автоматически получаем таймзону браузера
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'

      await fetch(`${BASE}/api/push/settings`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('insight_token')}`,
        },
        body: JSON.stringify({
          targetDeckId: settings.deckId,
          timeStart: settings.timeStart,
          timeEnd: settings.timeEnd,
          timezone,
        }),
      })

      const authStore = useAuthStore()
      if (authStore.user) {
        authStore.user.pushTargetDeckId = settings.deckId === 'all' ? null : settings.deckId
        authStore.user.pushTimeStart = settings.timeStart
        authStore.user.pushTimeEnd = settings.timeEnd
        authStore.user.timezone = timezone
      }
    },
  },
})
