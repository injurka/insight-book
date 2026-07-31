import { applyAcl } from '~/01.shared/lib/acl'
import { api } from '~/01.shared/services/api.service'
import { ActivityStatsSchema, ActivityTokensSchema } from '~/01.shared/types/schemas/activity.schema'

export interface IActivityRepository {
  getStats: () => Promise<any>
  getTokens: (period: string) => Promise<any>
}

export class DefaultActivityRepository implements IActivityRepository {
  async getStats() {
    const raw = await api.activity.getStats()
    return applyAcl(ActivityStatsSchema, raw, 'activity.getStats()')
  }

  async getTokens(period: string) {
    const raw = await api.activity.getTokens(period)
    return applyAcl(ActivityTokensSchema, raw, 'activity.getTokens()')
  }
}

export const activityRepository: IActivityRepository = new DefaultActivityRepository()
