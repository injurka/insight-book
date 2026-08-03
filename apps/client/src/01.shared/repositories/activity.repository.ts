import type { ActivityStatsDomain, ActivityTokensDomain } from '~/01.shared/types/schemas/activity.schema'
import { applyAcl } from '~/01.shared/lib/acl'
import { api } from '~/01.shared/services/api.service'
import { ActivityStatsSchema, ActivityTokensSchema } from '~/01.shared/types/schemas/activity.schema'

export interface IActivityRepository {
  getStats: () => Promise<ActivityStatsDomain>
  getTokens: (period: string) => Promise<ActivityTokensDomain>
}

export class DefaultActivityRepository implements IActivityRepository {
  async getStats(): Promise<ActivityStatsDomain> {
    const raw = await api.activity.getStats()

    return applyAcl(ActivityStatsSchema, raw, 'activity.getStats()')
  }

  async getTokens(period: string): Promise<ActivityTokensDomain> {
    const raw = await api.activity.getTokens(period)

    return applyAcl(ActivityTokensSchema, raw, 'activity.getTokens()')
  }
}

export const activityRepository: IActivityRepository = new DefaultActivityRepository()
