import { and, eq, inArray, or } from 'drizzle-orm'
import { db } from '~/db'
import { catalogDb } from '~/db/catalog'
import { officialDecks, officialDeckWords } from '../db/catalog-schema'
import * as schema from '../db/schema'

export const quizRepository = {
  async getRawProgressList(userId: number, language: string) {
    return await db.select()
      .from(schema.userQuizProgress)
      .where(and(
        eq(schema.userQuizProgress.userId, userId),
        eq(schema.userQuizProgress.language, language),
      ))
  },

  async deleteProgressIds(ids: number[]) {
    if (ids.length === 0)
      return
    await db.delete(schema.userQuizProgress)
      .where(inArray(schema.userQuizProgress.id, ids))
  },

  async insertProgressBatch(inserts: (typeof schema.userQuizProgress.$inferInsert)[]) {
    if (inserts.length === 0)
      return
    await db.insert(schema.userQuizProgress).values(inserts).onConflictDoNothing()
  },

  async getProgressForLevel(userId: number, language: string, levelValue: string) {
    return await db.select()
      .from(schema.userQuizProgress)
      .where(and(
        eq(schema.userQuizProgress.userId, userId),
        eq(schema.userQuizProgress.language, language),
        eq(schema.userQuizProgress.levelValue, levelValue),
      ))
      .get()
  },

  async getOfficialDeck(language: string, levelValue: string) {
    return await catalogDb.select()
      .from(officialDecks)
      .where(and(
        eq(officialDecks.language, language),
        or(
          eq(officialDecks.difficulty, levelValue),
          eq(officialDecks.title, levelValue),
        ),
      ))
      .get()
  },

  async getDeckWords(deckId: number) {
    return await catalogDb.select()
      .from(officialDeckWords)
      .where(eq(officialDeckWords.deckId, deckId))
  },

  async updateProgress(id: number, data: Partial<typeof schema.userQuizProgress.$inferInsert>) {
    await db.update(schema.userQuizProgress)
      .set(data)
      .where(eq(schema.userQuizProgress.id, id))
  },

  async insertProgress(data: typeof schema.userQuizProgress.$inferInsert) {
    await db.insert(schema.userQuizProgress).values(data)
  },
}
