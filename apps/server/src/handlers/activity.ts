import { and, desc, eq, sql } from 'drizzle-orm'
import { json } from '~/utils/helpers'
import { db } from '../db'
import * as schema from '../db/schema'

export async function handleGetHeatmapData(req: Request, userId: number): Promise<Response> {
  const sinceDate = new Date()
  sinceDate.setDate(sinceDate.getDate() - 182)

  const activity = await db
    .select({
      date: schema.dailyActivity.date,
      count: sql<number>`${schema.dailyActivity.wordsAdded} + ${schema.dailyActivity.wordsReviewed} + ${schema.dailyActivity.pagesRead}`.mapWith(Number),
    })
    .from(schema.dailyActivity)
    .where(and(
      eq(schema.dailyActivity.userId, userId),
      sql`${schema.dailyActivity.date} >= ${sinceDate.toISOString().split('T')[0]}`,
    ))
    .orderBy(desc(schema.dailyActivity.date))

  return json(activity)
}

export async function handleGetTokenUsage(req: Request, userId: number): Promise<Response> {
  const stats = await db.select({
    action: schema.tokenUsage.action,
    model: schema.tokenUsage.model,
    inputTokens: sql<number>`SUM(${schema.tokenUsage.inputTokens})`.mapWith(Number),
    outputTokens: sql<number>`SUM(${schema.tokenUsage.outputTokens})`.mapWith(Number),
  })
    .from(schema.tokenUsage)
    .where(eq(schema.tokenUsage.userId, userId))
    .groupBy(schema.tokenUsage.action, schema.tokenUsage.model)

  const daily = await db.select({
    date: schema.tokenUsage.date,
    inputTokens: sql<number>`SUM(${schema.tokenUsage.inputTokens})`.mapWith(Number),
    outputTokens: sql<number>`SUM(${schema.tokenUsage.outputTokens})`.mapWith(Number),
  })
    .from(schema.tokenUsage)
    .where(eq(schema.tokenUsage.userId, userId))
    .groupBy(schema.tokenUsage.date)
    .orderBy(desc(schema.tokenUsage.date))
    .limit(30)

  return json({ stats, daily })
}
