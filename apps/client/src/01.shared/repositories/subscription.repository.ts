import type { SubscriptionTier } from '~/01.shared/types/models'
import { z } from 'zod'
import { applyAcl } from '~/01.shared/lib/acl'
import { api } from '~/01.shared/services/api.service'
import { SubscriptionTierSchema } from '~/01.shared/types/schemas/subscription.schema'

export interface ISubscriptionRepository {
  getTiers: (lang: string) => Promise<SubscriptionTier[]>
}

export class DefaultSubscriptionRepository implements ISubscriptionRepository {
  async getTiers(lang: string) {
    const raw = await api.subscriptions.getTiers(lang)

    return applyAcl(z.array(SubscriptionTierSchema), raw, `subscription.getTiers(${lang})`)
  }
}

export const subscriptionRepository: ISubscriptionRepository = new DefaultSubscriptionRepository()
