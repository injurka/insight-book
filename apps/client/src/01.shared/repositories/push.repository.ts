import { invoke, isTauri } from '@tauri-apps/api/core'
import { applyAcl } from '~/01.shared/lib/acl'
import { API_URL } from '~/01.shared/lib/env'
import { VapidPublicKeyResponseSchema } from '~/01.shared/types/schemas/push.schema'

export interface IPushRepository {
  subscribeFcm: (token: string) => Promise<void>
  unsubscribeFcm: (token: string) => Promise<void>
  subscribeWeb: (sub: PushSubscription) => Promise<void>
  unsubscribeWeb: (endpoint: string) => Promise<void>
  getVapidPublicKey: () => Promise<string>
  updateSettings: (settings: { targetDeckId: number | 'all', timeStart: string, timeEnd: string, timezone: string, uiLanguage: string, pushCount: number }) => Promise<void>

  // Native Tauri wrappers
  getNativeFcmToken: () => Promise<string | null>
  requestNativeFcmToken: () => Promise<string>
  unsubscribeNativeFcm: () => Promise<void>
}

export class DefaultPushRepository implements IPushRepository {
  private getHeaders() {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${localStorage.getItem('insight_token')}`,
    }
  }

  private getBaseUrl() {
    return API_URL
  }

  async subscribeFcm(token: string) {
    await fetch(`${this.getBaseUrl()}/api/push/fcm-subscribe`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ token }),
    })
  }

  async unsubscribeFcm(token: string) {
    await fetch(`${this.getBaseUrl()}/api/push/fcm-unsubscribe`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ token }),
    })
  }

  async subscribeWeb(sub: PushSubscription) {
    await fetch(`${this.getBaseUrl()}/api/push/subscribe`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(sub),
    })
  }

  async unsubscribeWeb(endpoint: string) {
    await fetch(`${this.getBaseUrl()}/api/push/unsubscribe`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ endpoint }),
    })
  }

  async getVapidPublicKey() {
    const res = await fetch(`${this.getBaseUrl()}/api/push/vapid-public-key`, {
      headers: this.getHeaders(),
    })
    if (!res.ok)
      throw new Error('VAPID key fetch failed')
    const raw = await res.json()
    const data = applyAcl(VapidPublicKeyResponseSchema, raw, 'push.getVapidPublicKey()')
    return data.publicKey
  }

  async updateSettings(settings: { targetDeckId: number | 'all', timeStart: string, timeEnd: string, timezone: string, uiLanguage: string, pushCount: number }) {
    await fetch(`${this.getBaseUrl()}/api/push/settings`, {
      method: 'PATCH',
      headers: this.getHeaders(),
      body: JSON.stringify(settings),
    })
  }

  async getNativeFcmToken() {
    if (!isTauri())
      return null
    return await invoke<string | null>('get_fcm_token').catch(() => null)
  }

  async requestNativeFcmToken() {
    if (!isTauri())
      throw new Error('Not running in Tauri')
    return await invoke<string>('request_fcm_token')
  }

  async unsubscribeNativeFcm() {
    if (!isTauri())
      return
    await invoke('unsubscribe_fcm').catch(() => null)
  }
}

export const pushRepository: IPushRepository = new DefaultPushRepository()
