import { eq, sql } from 'drizzle-orm'
import { db } from '../db'
import * as schema from '../db/schema'
import { AppError } from '../utils/errors'

export async function checkTokenLimit(userId: number): Promise<void> {
  const user = await db.query.users.findFirst({
    where: eq(schema.users.id, userId),
    columns: { usedTokens: true, tokenLimit: true },
  })

  // 1. Абсолютный исторический лимит пользователя (если он задан)
  if (user && user.tokenLimit !== null && user.usedTokens >= user.tokenLimit) {
    throw new AppError(403, 'Превышен лимит использования ИИ (токенов)')
  }

  // Todo МБ
  // 2. Дневной лимит - защита от багов, циклов и парсинга (спасет бюджет)
  // const date = new Date().toISOString().split('T')[0]
  // const [{ todayTokens }] = await db.select({
  //   todayTokens: sql<number>`COALESCE(SUM(${schema.tokenUsage.inputTokens} + ${schema.tokenUsage.outputTokens}), 0)`.mapWith(Number),
  // })
  //   .from(schema.tokenUsage)
  //   .where(
  //     and(
  //       eq(schema.tokenUsage.userId, userId),
  //       eq(schema.tokenUsage.date, date),
  //     ),
  //   )

  // if (todayTokens >= MAX_DAILY_TOKENS) {
  //   throw new AppError(429, `Превышен дневной лимит токенов безопасности (${MAX_DAILY_TOKENS}). Пожалуйста, сделайте паузу до завтра или увеличьте MAX_DAILY_TOKENS в настройках сервера.`)
  // }
}

export async function checkBookLimit(userId: number): Promise<void> {
  const user = await db.query.users.findFirst({
    where: eq(schema.users.id, userId),
    columns: { bookLimit: true, periodStart: true },
  })

  if (user && user.bookLimit !== null) {
    const [{ count }] = await db.select({ count: sql<number>`count(*)` })
      .from(schema.books)
      .where(
        sql`${schema.books.userId} = ${userId} AND datetime(${schema.books.createdAt}) >= datetime(${user.periodStart})`,
      )
    if (count >= user.bookLimit) {
      throw new AppError(403, `Превышен лимит книг в библиотеке (макс. ${user.bookLimit})`)
    }
  }
}
