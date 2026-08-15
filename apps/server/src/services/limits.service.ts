import { eq, sql } from 'drizzle-orm'
import { ERROR_CODES } from '../constants/error-codes'
import { db } from '../db'
import * as schema from '../db/schema'
import { AppError } from '../utils/errors'

export async function checkTokenLimit(userId: number, neededTokens: number = 1): Promise<void> {
  const user = await db.query.users.findFirst({
    where: eq(schema.users.id, userId),
    columns: { usedTokens: true, tokenLimit: true },
  })

  // 1. Абсолютный исторический лимит пользователя (если он задан)
  if (user && user.tokenLimit !== null && (user.usedTokens + neededTokens) > user.tokenLimit) {
    throw new AppError(403, ERROR_CODES.LIMITS.TOKEN_LIMIT_EXCEEDED, 'AI token limit exceeded')
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
      throw new AppError(403, ERROR_CODES.LIMITS.BOOK_LIMIT_EXCEEDED, 'Book limit exceeded', { maxBooks: user.bookLimit })
    }
  }
}
