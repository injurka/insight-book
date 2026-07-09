import { and, desc, eq, sql } from 'drizzle-orm'
import { getAiConfig } from '~/utils/ai-config'
import { json } from '~/utils/helpers'
import { db } from '../db'
import * as schema from '../db/schema'

export async function handleGetActivityStats(req: Request, userId: number): Promise<Response> {
  const sinceDate = new Date()
  sinceDate.setDate(sinceDate.getDate() - 182)

  const heatmap = await db
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

  const [{ learnedWords }] = await db.select({
    learnedWords: sql<number>`count(*)`.mapWith(Number),
  })
    .from(schema.userDictionary)
    .where(and(
      eq(schema.userDictionary.userId, userId),
      eq(schema.userDictionary.state, 2), // 2 = FSRS State.Review (Выучено/Повторение)
    ))

  const [{ readPages }] = await db.select({
    readPages: sql<number>`SUM(${schema.dailyActivity.pagesRead})`.mapWith(Number),
  })
    .from(schema.dailyActivity)
    .where(eq(schema.dailyActivity.userId, userId))

  const difficulties = await db.select({
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

  const quizProgress = await db.select({
    language: schema.userQuizProgress.language,
    levelValue: schema.userQuizProgress.levelValue,
    bestScore: schema.userQuizProgress.bestScore,
    stars: schema.userQuizProgress.stars,
    unlocked: schema.userQuizProgress.unlocked,
  })
    .from(schema.userQuizProgress)
    .where(eq(schema.userQuizProgress.userId, userId))

  return json({
    heatmap,
    learnedWords: learnedWords || 0,
    readPages: readPages || 0,
    difficulties,
    quizProgress,
  })
}

export async function handleGetTokenUsage(req: Request, userId: number): Promise<Response> {
  const aiConfig = getAiConfig()
  const pricing = aiConfig.pricing

  const url = new URL(req.url)
  const period = url.searchParams.get('period') || 'all'

  let dateFilter = sql`1=1`
  if (period === 'today') {
    const today = new Date().toISOString().split('T')[0]
    dateFilter = eq(schema.tokenUsage.date, today)
  }
  else if (period === 'week') {
    const weekAgo = new Date()
    weekAgo.setDate(weekAgo.getDate() - 7)
    dateFilter = sql`${schema.tokenUsage.date} >= ${weekAgo.toISOString().split('T')[0]}`
  }

  const statsRaw = await db.select({
    action: schema.tokenUsage.action,
    model: schema.tokenUsage.model,
    inputTokens: sql<number>`SUM(${schema.tokenUsage.inputTokens})`.mapWith(Number),
    outputTokens: sql<number>`SUM(${schema.tokenUsage.outputTokens})`.mapWith(Number),
  })
    .from(schema.tokenUsage)
    .where(and(eq(schema.tokenUsage.userId, userId), dateFilter))
    .groupBy(schema.tokenUsage.action, schema.tokenUsage.model)

  const actionMap = new Map<string, any>()

  for (const row of statsRaw) {
    const price = pricing[row.model] || { input: 0, output: 0 }
    const cost = (row.inputTokens / 1_000_000) * price.input + (row.outputTokens / 1_000_000) * price.output

    if (!actionMap.has(row.action)) {
      actionMap.set(row.action, { action: row.action, inputTokens: 0, outputTokens: 0, cost: 0 })
    }
    const act = actionMap.get(row.action)
    act.inputTokens += row.inputTokens
    act.outputTokens += row.outputTokens
    act.cost += cost
  }

  const stats = Array.from(actionMap.values())
  const totalCost = stats.reduce((sum, item) => sum + item.cost, 0)

  const dailyRaw = await db.select({
    date: schema.tokenUsage.date,
    model: schema.tokenUsage.model,
    inputTokens: sql<number>`SUM(${schema.tokenUsage.inputTokens})`.mapWith(Number),
    outputTokens: sql<number>`SUM(${schema.tokenUsage.outputTokens})`.mapWith(Number),
  })
    .from(schema.tokenUsage)
    .where(and(eq(schema.tokenUsage.userId, userId), dateFilter))
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

  const user = await db.query.users.findFirst({ where: eq(schema.users.id, userId) })
  const isAdmin = user?.role === 'admin'

  if (!isAdmin) {
    stats.forEach(s => s.cost = null)
    daily.forEach(d => d.cost = null)
  }

  return json({ stats, daily, totalCost: isAdmin ? totalCost : null })
}
