import type { IActivityRepository, IUserRepository } from '../repositories/interfaces'
import { getAiConfig } from '~/utils/ai-config'
import { ROLES } from '../constants/roles'
import { activityRepository } from '../repositories/activity.repository'
import { userRepository } from '../repositories/user.repository'

export class ActivityService {
  constructor(
    private activityRepo: IActivityRepository = activityRepository,
    private userRepo: IUserRepository = userRepository,
  ) {}

  async getActivityStats(userId: number) {
    const sinceDate = new Date()
    sinceDate.setDate(sinceDate.getDate() - 182)
    const sinceDateStr = sinceDate.toISOString().split('T')[0]

    const [heatmap, learnedWords, readPages, difficulties, quizProgress] = await Promise.all([
      this.activityRepo.getDailyActivityHeatmap(userId, sinceDateStr),
      this.activityRepo.getLearnedWordsCount(userId),
      this.activityRepo.getReadPagesCount(userId),
      this.activityRepo.getDifficulties(userId),
      this.activityRepo.getQuizProgress(userId),
    ])

    return {
      heatmap,
      learnedWords: learnedWords || 0,
      readPages: readPages || 0,
      difficulties,
      quizProgress,
    }
  }

  async getTokenUsage(userId: number, period: string = 'all') {
    const aiConfig = getAiConfig()
    const pricing = aiConfig.pricing

    const [statsRaw, dailyRaw, user] = await Promise.all([
      this.activityRepo.getTokenUsageStats(userId, period),
      this.activityRepo.getDailyTokenUsage(userId, period),
      this.userRepo.findById(userId),
    ])

    const isAdmin = user?.role === ROLES.ADMIN

    const actionMap = new Map<string, {
      action: string
      inputTokens: number
      outputTokens: number
      audioInputSeconds: number
      audioOutputSeconds: number
      cost: number | null
    }>()

    for (const row of statsRaw) {
      const price = pricing[row.model] || { input: 0, output: 0 }
      const cost = (row.inputTokens / 1_000_000) * price.input + (row.outputTokens / 1_000_000) * price.output

      if (!actionMap.has(row.action)) {
        actionMap.set(row.action, {
          action: row.action,
          inputTokens: 0,
          outputTokens: 0,
          audioInputSeconds: 0,
          audioOutputSeconds: 0,
          cost: 0,
        })
      }
      const act = actionMap.get(row.action)!
      act.inputTokens += row.inputTokens
      act.outputTokens += row.outputTokens
      act.audioInputSeconds += row.audioInputSeconds || 0
      act.audioOutputSeconds += row.audioOutputSeconds || 0
      act.cost = (act.cost || 0) + cost
    }

    const stats = Array.from(actionMap.values())
    const totalCost = stats.reduce((sum, item) => sum + (item.cost || 0), 0)

    const dailyMap = new Map<string, {
      date: string
      inputTokens: number
      outputTokens: number
      audioInputSeconds: number
      audioOutputSeconds: number
      cost: number | null
    }>()

    for (const row of dailyRaw) {
      const price = pricing[row.model] || { input: 0, output: 0 }
      const cost = (row.inputTokens / 1_000_000) * price.input + (row.outputTokens / 1_000_000) * price.output

      if (!dailyMap.has(row.date)) {
        dailyMap.set(row.date, {
          date: row.date,
          inputTokens: 0,
          outputTokens: 0,
          audioInputSeconds: 0,
          audioOutputSeconds: 0,
          cost: 0,
        })
      }
      const day = dailyMap.get(row.date)!
      day.inputTokens += row.inputTokens
      day.outputTokens += row.outputTokens
      day.audioInputSeconds += row.audioInputSeconds || 0
      day.audioOutputSeconds += row.audioOutputSeconds || 0
      day.cost = (day.cost || 0) + cost
    }

    const daily = Array.from(dailyMap.values())
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 30)

    if (!isAdmin) {
      stats.forEach(s => s.cost = null)
      daily.forEach(d => d.cost = null)
    }

    return { stats, daily, totalCost: isAdmin ? totalCost : null }
  }

  async trackActivity(userId: number, field: 'wordsAdded' | 'wordsReviewed' | 'pagesRead', increment: number = 1) {
    await this.activityRepo.incrementActivity(userId, field, increment)
  }
}

export const activityService = new ActivityService()
