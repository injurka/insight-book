import { getAiConfig } from '~/utils/ai-config'
import { activityRepository } from '../repositories/activity.repository'

export class ActivityService {
  async getActivityStats(userId: number) {
    const sinceDate = new Date()
    sinceDate.setDate(sinceDate.getDate() - 182)
    const sinceDateStr = sinceDate.toISOString().split('T')[0]

    const [heatmap, learnedWords, readPages, difficulties, quizProgress] = await Promise.all([
      activityRepository.getDailyActivityHeatmap(userId, sinceDateStr),
      activityRepository.getLearnedWordsCount(userId),
      activityRepository.getReadPagesCount(userId),
      activityRepository.getDifficulties(userId),
      activityRepository.getQuizProgress(userId),
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
      activityRepository.getTokenUsageStats(userId, period),
      activityRepository.getDailyTokenUsage(userId, period),
      activityRepository.getUser(userId),
    ])

    const isAdmin = user?.role === 'admin'

    const actionMap = new Map<string, { action: string, inputTokens: number, outputTokens: number, cost: number | null }>()
    for (const row of statsRaw) {
      const price = pricing[row.model] || { input: 0, output: 0 }
      const cost = (row.inputTokens / 1_000_000) * price.input + (row.outputTokens / 1_000_000) * price.output

      if (!actionMap.has(row.action)) {
        actionMap.set(row.action, { action: row.action, inputTokens: 0, outputTokens: 0, cost: 0 })
      }
      const act = actionMap.get(row.action)
      act!.inputTokens += row.inputTokens
      act!.outputTokens += row.outputTokens
      act!.cost = (act!.cost || 0) + cost
    }

    const stats = Array.from(actionMap.values())
    const totalCost = stats.reduce((sum, item) => sum + (item.cost || 0), 0)

    const dailyMap = new Map<string, { date: string, inputTokens: number, outputTokens: number, cost: number | null }>()
    for (const row of dailyRaw) {
      const price = pricing[row.model] || { input: 0, output: 0 }
      const cost = (row.inputTokens / 1_000_000) * price.input + (row.outputTokens / 1_000_000) * price.output

      if (!dailyMap.has(row.date)) {
        dailyMap.set(row.date, { date: row.date, inputTokens: 0, outputTokens: 0, cost: 0 })
      }
      const day = dailyMap.get(row.date)
      day!.inputTokens += row.inputTokens
      day!.outputTokens += row.outputTokens
      day!.cost = (day!.cost || 0) + cost
    }

    const daily = Array.from(dailyMap.values()).slice(0, 30)
    daily.sort((a, b) => b.date.localeCompare(a.date))

    if (!isAdmin) {
      stats.forEach(s => s.cost = null)
      daily.forEach(d => d.cost = null)
    }

    return { stats, daily, totalCost: isAdmin ? totalCost : null }
  }

  async trackActivity(userId: number, field: 'wordsAdded' | 'wordsReviewed' | 'pagesRead', increment: number = 1) {
    await activityRepository.incrementActivity(userId, field, increment)
  }
}

export const activityService = new ActivityService()
