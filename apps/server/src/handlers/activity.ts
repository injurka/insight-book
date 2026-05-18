import { and, desc, eq, sql } from 'drizzle-orm'
import { CORS_HEADERS } from '../config'
import { db } from '../db'
import * as schema from '../db/schema'

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}

export async function handleGetHeatmapData(req: Request, userId: number): Promise<Response> {
  // Запрашиваем данные за последние 26 недель (182 дня)
  const sinceDate = new Date()
  sinceDate.setDate(sinceDate.getDate() - 182)

  const activity = await db
    .select({
      date: schema.dailyActivity.date,
      // Суммируем все виды активности в одно число "count"
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
