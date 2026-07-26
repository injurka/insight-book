import type { IHighlightRepository } from './interfaces'
import { and, desc, eq } from 'drizzle-orm'
import { db } from '../db'
import * as schema from '../db/schema'

export class HighlightRepository implements IHighlightRepository {
  async findMany(userId: number, bookId?: number) {
    const conditions = [eq(schema.highlights.userId, userId)]
    if (bookId) {
      conditions.push(eq(schema.highlights.bookId, bookId))
    }
    return db.query.highlights.findMany({
      where: and(...conditions),
      orderBy: desc(schema.highlights.createdAt),
    })
  }

  async create(data: typeof schema.highlights.$inferInsert) {
    const [newHighlight] = await db.insert(schema.highlights).values(data).returning()
    return newHighlight
  }

  async update(id: number, userId: number, data: Partial<typeof schema.highlights.$inferInsert>) {
    const [updatedHighlight] = await db.update(schema.highlights)
      .set(data)
      .where(and(
        eq(schema.highlights.id, id),
        eq(schema.highlights.userId, userId),
      ))
      .returning()
    return updatedHighlight
  }

  async delete(id: number, userId: number) {
    const deleted = await db.delete(schema.highlights)
      .where(and(
        eq(schema.highlights.id, id),
        eq(schema.highlights.userId, userId),
      ))
      .returning()
    return deleted.length > 0
  }
}

export const highlightRepository = new HighlightRepository()
