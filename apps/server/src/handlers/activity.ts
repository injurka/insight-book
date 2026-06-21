import { and, desc, eq, sql } from 'drizzle-orm'
import { getAiConfig } from '~/utils/ai-config'
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
  const aiConfig = getAiConfig()
  const pricing = aiConfig.pricing

  const statsRaw = await db.select({
    action: schema.tokenUsage.action,
    model: schema.tokenUsage.model,
    inputTokens: sql<number>`SUM(${schema.tokenUsage.inputTokens})`.mapWith(Number),
    outputTokens: sql<number>`SUM(${schema.tokenUsage.outputTokens})`.mapWith(Number),
  })
    .from(schema.tokenUsage)
    .where(eq(schema.tokenUsage.userId, userId))
    .groupBy(schema.tokenUsage.action, schema.tokenUsage.model)

  const stats = statsRaw.map((row) => {
    const price = pricing[row.model] || { input: 0, output: 0 }
    const cost = (row.inputTokens / 1_000_000) * price.input + (row.outputTokens / 1_000_000) * price.output
    return { ...row, cost }
  })

  const totalCost = stats.reduce((sum, item) => sum + item.cost, 0)

  const dailyRaw = await db.select({
    date: schema.tokenUsage.date,
    model: schema.tokenUsage.model,
    inputTokens: sql<number>`SUM(${schema.tokenUsage.inputTokens})`.mapWith(Number),
    outputTokens: sql<number>`SUM(${schema.tokenUsage.outputTokens})`.mapWith(Number),
  })
    .from(schema.tokenUsage)
    .where(eq(schema.tokenUsage.userId, userId))
    .groupBy(schema.tokenUsage.date, schema.tokenUsage.model)
    .orderBy(desc(schema.tokenUsage.date))

  const dailyMap = new Map<string, any>()
  for (const row of dailyRaw) {
    const price = pricing[row.model] || { input: 0, output: 0 }
    const cost = (row.inputTokens / 1_000_000) * price.input + (row.outputTokens / 1_000_000) * price.output

    if (!dailyMap.has(row.date)) {
      dailyMap.set(row.date, { date: row.date, inputTokens: 0, outputTokens: 0, cost: 0 })
    }
    const day = dailyMap.get(row.date)
    day.inputTokens += row.inputTokens
    day.outputTokens += row.outputTokens
    day.cost += cost
  }

  const daily = Array.from(dailyMap.values()).slice(0, 30)
  daily.sort((a, b) => b.date.localeCompare(a.date))

  return json({ stats, daily, totalCost })
}
