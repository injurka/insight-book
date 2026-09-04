import { applyAcl } from '~/01.shared/lib/acl'
import { api } from '~/01.shared/services/api.service'
import { VapidPublicKeyResponseSchema } from '~/01.shared/types/schemas/push.schema'

export interface IPushRepository {
  subscribeWeb: (sub: PushSubscription) => Promise<void>
  unsubscribeWeb: (endpoint: string) => Promise<void>
  getVapidPublicKey: () => Promise<string>
  updateSettings: (settings: { targetDeckId: number | 'all', timeStart: string, timeEnd: string, timezone: string, uiLanguage: string, pushCount: number }) => Promise<void>
}

export class DefaultPushRepository implements IPushRepository {
  async subscribeWeb(sub: PushSubscription) {
    await api.push.subscribe(sub)
  }

  async unsubscribeWeb(endpoint: string) {
    await api.push.unsubscribe(endpoint)
  }

  async getVapidPublicKey() {
    const raw = await api.push.getVapidPublicKey()
    const data = applyAcl(VapidPublicKeyResponseSchema, raw, 'push.getVapidPublicKey()')

    return data.publicKey
  }

  async updateSettings(settings: { targetDeckId: number | 'all', timeStart: string, timeEnd: string, timezone: string, uiLanguage: string, pushCount: number }) {
    await api.push.updateSettings(settings)
  }
}

export const pushRepository: IPushRepository = new DefaultPushRepository()
