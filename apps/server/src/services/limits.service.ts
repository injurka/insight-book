import { eq, sql } from 'drizzle-orm'
import { db } from '../db'
import * as schema from '../db/schema'
import { AppError } from '../utils/errors'

export async function checkTokenLimit(userId: number): Promise<void> {
  const user = await db.query.users.findFirst({
    where: eq(schema.users.id, userId),
    columns: { usedTokens: true, tokenLimit: true },
  })

  if (user && user.tokenLimit !== null && user.usedTokens >= user.tokenLimit) {
    throw new AppError(403, 'Превышен лимит использования ИИ (токенов)')
  }
}

export async function checkBookLimit(userId: number): Promise<void> {
  const user = await db.query.users.findFirst({
    where: eq(schema.users.id, userId),
    columns: { bookLimit: true },
  })

  if (user && user.bookLimit !== null) {
    const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(schema.books).where(eq(schema.books.userId, userId))
    if (count >= user.bookLimit) {
      throw new AppError(403, `Превышен лимит книг в библиотеке (макс. ${user.bookLimit})`)
    }
  }
}
