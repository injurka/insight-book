import { api } from '~/shared/services/api.service'

export interface IActivityRepository {
  getStats: () => Promise<any>
  getTokens: (period: string) => Promise<any>
}

export class DefaultActivityRepository implements IActivityRepository {
  async getStats() { return await api.activity.getStats() }
  async getTokens(period: string) { return await api.activity.getTokens(period) }
}

export const activityRepository: IActivityRepository = new DefaultActivityRepository()
