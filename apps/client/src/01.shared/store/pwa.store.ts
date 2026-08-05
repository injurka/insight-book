import { defineStore } from 'pinia'

import { useRepos } from '~/00.plugins/di'
import { i18n } from '~/00.plugins/i18n'
import { useAuthStore } from './auth.store'
import { useToastStore } from './toast.store'

const repos = useRepos()

type UpdateServiceWorkerFunction = (reloadPage?: boolean) => Promise<void>

export interface ToastService {
  success: (message: string) => void
  error: (message: string) => void
  info: (message: string) => void
}

export type TranslateFn = (key: string) => string

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
  for (let i = 0; i < rawData.length; ++i)
    outputArray[i] = rawData.charCodeAt(i)

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
      try {
        if (this.updateServiceWorker)
          await this.updateServiceWorker(true)
      }
      catch (error) {
        console.error('Failed to trigger update:', error)
      }
      finally {
        this.needRefresh = false
        localStorage.setItem('insight_last_update_prompt', Date.now().toString())
      }
    },

    closePrompt() {
      this.offlineReady = false
      this.needRefresh = false
      localStorage.setItem('insight_last_update_prompt', Date.now().toString())
    },

    async checkPushStatus() {
      const token = localStorage.getItem('insight_token')

      await this.checkWebPushStatus(token)

      // Sync timezone if changed
      const authStore = useAuthStore()
      const currentTimezone = new Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
      if (token && authStore.user && authStore.user.timezone !== currentTimezone) {
        this.updatePushSettings({
          deckId: authStore.user.pushTargetDeckId ?? 'all',
          timeStart: authStore.user.pushTimeStart ?? '10:00',
          timeEnd: authStore.user.pushTimeEnd ?? '21:00',
          pushCount: authStore.user.pushCount ?? 1,
        }).catch(console.error)
      }
    },

    async checkWebPushStatus(token: string | null) {
      if ('permissions' in navigator) {
        navigator.permissions.query({ name: 'notifications' }).then((status) => {
          status.onchange = () => {
            if (status.state === 'denied' || status.state === 'prompt')
              this.isPushSubscribed = false
            else if (status.state === 'granted')
              this.checkPushStatus()
          }
        }).catch(() => { })
      }

      if ('serviceWorker' in navigator && 'PushManager' in window) {
        try {
          const reg = await navigator.serviceWorker.ready
          const sub = await reg.pushManager.getSubscription()
          const hasPermission = Notification.permission === 'granted'
          this.isPushSubscribed = !!sub && hasPermission
          if (this.isPushSubscribed && sub && token)
            repos.push.subscribeWeb(sub).catch(() => { })
        }
        catch (e) {
          console.warn('Web Push status check failed', e)
        }
      }
    },

    async togglePushSubscription() {
      const toast = useToastStore()
      const t = i18n.global.t

      await this.toggleWebPush(toast, t)
    },

    initSubscribedSettings() {
      const authStore = useAuthStore()
      this.updatePushSettings({
        deckId: authStore.user?.pushTargetDeckId ?? 'all',
        timeStart: authStore.user?.pushTimeStart ?? '10:00',
        timeEnd: authStore.user?.pushTimeEnd ?? '21:00',
        pushCount: authStore.user?.pushCount ?? 1,
      }).catch(console.error)
    },

    async fetchVapidKey(toast: ToastService, t: TranslateFn): Promise<string> {
      let publicKey: string
      try {
        publicKey = await repos.push.getVapidPublicKey()
      }
      catch (e) {
        toast.error(t('settings.pushKeyError'))
        throw e
      }

      if (!publicKey) {
        toast.error(t('settings.pushKeyError') || 'VAPID key missing')
        throw new Error('No public key')
      }

      return publicKey
    },

    async subscribeWebPush(toast: ToastService, t: TranslateFn, reg: ServiceWorkerRegistration) {
      const permission = await Notification.requestPermission()
      if (permission === 'denied') {
        toast.error(t('settings.pushDenied'))
        throw new Error('Permission denied')
      }

      const publicKey = await this.fetchVapidKey(toast, t)

      let sub: PushSubscription
      try {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        })
      }
      catch (e) {
        const err = e as Error
        toast.error(`${t('settings.pushSubError')}: ${err.message}`)
        throw e
      }

      try {
        await repos.push.subscribeWeb(sub)
      }
      catch (e) {
        toast.error(t('settings.pushSubError'))
        throw e
      }

      this.isPushSubscribed = true
      toast.success(t('settings.pushEnabled'))

      this.initSubscribedSettings()
    },

    async toggleWebPush(toast: ToastService, t: TranslateFn) {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        toast.error(t('settings.pushNotSupported'))
        throw new Error('Push not supported')
      }

      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()

      if (sub) {
        await sub.unsubscribe()
        await repos.push.unsubscribeWeb(sub.endpoint)
        this.isPushSubscribed = false
        toast.info(t('settings.pushDisabled'))

        return
      }

      await this.subscribeWebPush(toast, t, reg)
    },

    async updatePushSettings(settings: { deckId: number | 'all', timeStart: string, timeEnd: string, pushCount: number }) {
      const timezone = new Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'

      const { useGlobalSettingsStore } = await import('./settings.store')
      const settingsStore = useGlobalSettingsStore()
      const uiLanguage = settingsStore.appLanguage || 'ru'

      await repos.push.updateSettings({
        targetDeckId: settings.deckId,
        timeStart: settings.timeStart,
        timeEnd: settings.timeEnd,
        timezone,
        uiLanguage,
        pushCount: settings.pushCount ?? 1,
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
