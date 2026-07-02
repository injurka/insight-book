import { defineStore } from 'pinia'
import { i18n } from '~/shared/plugins/i18n'
import { useAuthStore } from './auth.store'
import { useToastStore } from './toast.store'

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
      const hasPermission = Notification.permission === 'granted'

      this.isPushSubscribed = !!sub && hasPermission

      // Синхронизируем свежие ключи с бэкендом, если подписка активна
      if (this.isPushSubscribed && sub) {
        const BASE = import.meta.env.VITE_API_URL || 'https://insight-api.trip-scheduler.ru'
        fetch(`${BASE}/api/push/subscribe`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('insight_token')}`,
          },
          body: JSON.stringify(sub),
        }).catch(() => { })
      }
    },

    async togglePushSubscription() {
      const toast = useToastStore()
      const t = i18n.global.t

      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        toast.error(t('settings.pushNotSupported'))
        throw new Error('Push not supported')
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
        toast.info(t('settings.pushDisabled'))
      }
      else {
        const permission = await Notification.requestPermission()
        if (permission === 'denied') {
          toast.error(t('settings.pushDenied'))
          throw new Error('Permission denied')
        }

        const res = await fetch(`${BASE}/api/push/vapid-public-key`, { headers })
        if (!res.ok) {
          toast.error(t('settings.pushKeyError'))
          throw new Error('VAPID key fetch failed')
        }

        const { publicKey } = await res.json()
        if (!publicKey) {
          toast.error(t('settings.pushKeyError') || 'VAPID key missing')
          throw new Error('No public key')
        }

        try {
          sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(publicKey),
          })
        }
        catch (e: unknown) {
          toast.error(`${t('settings.pushSubError')}: ${(e as Error).message}`)
          throw e
        }

        const subRes = await fetch(`${BASE}/api/push/subscribe`, {
          method: 'POST',
          headers,
          body: JSON.stringify(sub),
        })

        if (!subRes.ok) {
          toast.error(t('settings.pushSubError'))
          throw new Error('Subscription API request failed')
        }

        this.isPushSubscribed = true
        toast.success(t('settings.pushEnabled'))

        const authStore = useAuthStore()
        this.updatePushSettings({
          deckId: authStore.user?.pushTargetDeckId ?? 'all',
          timeStart: authStore.user?.pushTimeStart ?? '10:00',
          timeEnd: authStore.user?.pushTimeEnd ?? '21:00',
          pushCount: authStore.user?.pushCount ?? 1,
        }).catch(console.error)
      }
    },

    async updatePushSettings(settings: { deckId: number | 'all', timeStart: string, timeEnd: string, pushCount: number }) {
      const BASE = import.meta.env.VITE_API_URL || 'https://insight-api.trip-scheduler.ru'
      const timezone = new Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'

      const { useGlobalSettingsStore } = await import('./settings.store')
      const settingsStore = useGlobalSettingsStore()
      const uiLanguage = settingsStore.appLanguage || 'ru'

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
          uiLanguage,
          pushCount: settings.pushCount ?? 1,
        }),
      })

      const authStore = useAuthStore()
      if (authStore.user) {
        authStore.user.pushTargetDeckId = settings.deckId === 'all' ? null : settings.deckId
        authStore.user.pushTimeStart = settings.timeStart
        authStore.user.pushTimeEnd = settings.timeEnd
        authStore.user.pushCount = settings.pushCount ?? authStore.user.pushCount ?? 1
        authStore.user.timezone = timezone
        authStore.user.uiLanguage = uiLanguage
      }
    },
  },
})
