import type { SQL } from 'drizzle-orm'
import type { IActivityRepository } from './interfaces'
import { and, desc, eq, sql } from 'drizzle-orm'
import { db } from '../db'
import * as schema from '../db/schema'

export class ActivityRepository implements IActivityRepository {
  async getDailyActivityHeatmap(userId: number, sinceDateStr: string) {
    return await db
      .select({
        date: schema.dailyActivity.date,
        count: sql<number>`${schema.dailyActivity.wordsAdded} + ${schema.dailyActivity.wordsReviewed} + ${schema.dailyActivity.pagesRead}`.mapWith(Number),
      })
      .from(schema.dailyActivity)
      .where(and(
        eq(schema.dailyActivity.userId, userId),
        sql`${schema.dailyActivity.date} >= ${sinceDateStr}`,
      ))
      .orderBy(desc(schema.dailyActivity.date))
  }

  async getLearnedWordsCount(userId: number) {
    const [{ learnedWords }] = await db.select({
      learnedWords: sql<number>`count(*)`.mapWith(Number),
    })
      .from(schema.userDictionary)
      .where(and(
        eq(schema.userDictionary.userId, userId),
        eq(schema.userDictionary.state, 2),
      ))
    return learnedWords
  }

  async getReadPagesCount(userId: number) {
    const [{ readPages }] = await db.select({
      readPages: sql<number>`SUM(${schema.dailyActivity.pagesRead})`.mapWith(Number),
    })
      .from(schema.dailyActivity)
      .where(eq(schema.dailyActivity.userId, userId))
    return readPages
  }

  async getDifficulties(userId: number) {
    return await db.select({
      language: schema.userDictionary.language,
      difficulty: schema.userDictionary.difficulty,
      count: sql<number>`SUM(CASE WHEN ${schema.userDictionary.state} = 2 THEN 1 ELSE 0 END)`.mapWith(Number),
    })
      .from(schema.userDictionary)
      .where(and(
        eq(schema.userDictionary.userId, userId),
        sql`${schema.userDictionary.difficulty} IS NOT NULL`,
        sql`${schema.userDictionary.difficulty} != ''`,
      ))
      .groupBy(schema.userDictionary.language, schema.userDictionary.difficulty)
  }

  async getQuizProgress(userId: number) {
    return await db.select({
      language: schema.userQuizProgress.language,
      levelValue: schema.userQuizProgress.levelValue,
      bestScore: schema.userQuizProgress.bestScore,
      stars: schema.userQuizProgress.stars,
      unlocked: schema.userQuizProgress.unlocked,
    })
      .from(schema.userQuizProgress)
      .where(eq(schema.userQuizProgress.userId, userId))
  }

  getDateFilter(period: string): SQL {
    if (period === 'today') {
      const today = new Date().toISOString().split('T')[0]
      return eq(schema.tokenUsage.date, today)
    }
    if (period === 'week') {
      const weekAgo = new Date()
      weekAgo.setDate(weekAgo.getDate() - 7)
      return sql`${schema.tokenUsage.date} >= ${weekAgo.toISOString().split('T')[0]}`
    }
    return sql`1=1`
  }

  async getTokenUsageStats(userId: number, period: string) {
    const dateFilter = this.getDateFilter(period)
    return await db.select({
      action: schema.tokenUsage.action,
      model: schema.tokenUsage.model,
      inputTokens: sql<number>`SUM(${schema.tokenUsage.inputTokens})`.mapWith(Number),
      outputTokens: sql<number>`SUM(${schema.tokenUsage.outputTokens})`.mapWith(Number),
      audioInputSeconds: sql<number>`COALESCE(SUM(${schema.tokenUsage.audioInputSeconds}), 0)`.mapWith(Number),
      audioOutputSeconds: sql<number>`COALESCE(SUM(${schema.tokenUsage.audioOutputSeconds}), 0)`.mapWith(Number),
    })
      .from(schema.tokenUsage)
      .where(and(eq(schema.tokenUsage.userId, userId), dateFilter))
      .groupBy(schema.tokenUsage.action, schema.tokenUsage.model)
  }

  async getDailyTokenUsage(userId: number, period: string) {
    const dateFilter = this.getDateFilter(period)
    return await db.select({
      date: schema.tokenUsage.date,
      model: schema.tokenUsage.model,
      inputTokens: sql<number>`SUM(${schema.tokenUsage.inputTokens})`.mapWith(Number),
      outputTokens: sql<number>`SUM(${schema.tokenUsage.outputTokens})`.mapWith(Number),
      audioInputSeconds: sql<number>`COALESCE(SUM(${schema.tokenUsage.audioInputSeconds}), 0)`.mapWith(Number),
      audioOutputSeconds: sql<number>`COALESCE(SUM(${schema.tokenUsage.audioOutputSeconds}), 0)`.mapWith(Number),
    })
      .from(schema.tokenUsage)
      .where(and(eq(schema.tokenUsage.userId, userId), dateFilter))
      .groupBy(schema.tokenUsage.date, schema.tokenUsage.model)
      .orderBy(desc(schema.tokenUsage.date))
  }

  async getUser(userId: number) {
    return await db.query.users.findFirst({ where: eq(schema.users.id, userId) })
  }

  async incrementActivity(userId: number, field: 'wordsAdded' | 'wordsReviewed' | 'pagesRead', increment: number = 1) {
    const today = new Date().toISOString().split('T')[0]
    await db.insert(schema.dailyActivity)
      .values({ userId, date: today, [field]: increment })
      .onConflictDoUpdate({
        target: [schema.dailyActivity.userId, schema.dailyActivity.date],
        set: { [field]: sql`${schema.dailyActivity[field]} + ${increment}` },
      })
  }
}

export const activityRepository = new ActivityRepository()
