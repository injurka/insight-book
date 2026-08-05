import { applyAcl } from '~/01.shared/lib/acl'
import { API_URL } from '~/01.shared/lib/env'
import { VapidPublicKeyResponseSchema } from '~/01.shared/types/schemas/push.schema'

export interface IPushRepository {
  subscribeWeb: (sub: PushSubscription) => Promise<void>
  unsubscribeWeb: (endpoint: string) => Promise<void>
  getVapidPublicKey: () => Promise<string>
  updateSettings: (settings: { targetDeckId: number | 'all', timeStart: string, timeEnd: string, timezone: string, uiLanguage: string, pushCount: number }) => Promise<void>
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
}

export const pushRepository: IPushRepository = new DefaultPushRepository()
