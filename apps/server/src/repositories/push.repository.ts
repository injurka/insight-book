import type { SQL } from 'drizzle-orm'
import type { IPushRepository } from './interfaces'
import { and, eq, inArray, lte, sql } from 'drizzle-orm'
import { db } from '../db'
import * as schema from '../db/schema'

export class PushRepository implements IPushRepository {
  async upsertWebSubscription(userId: number, endpoint: string, keys: Record<string, string>) {
    return db.insert(schema.webPushSubscriptions).values({
      userId,
      endpoint,
      keys: JSON.stringify(keys),
    }).onConflictDoUpdate({
      target: schema.webPushSubscriptions.endpoint,
      set: {
        userId,
        keys: JSON.stringify(keys),
      },
    })
  }

  async deleteWebSubscription(userId: number, endpoint: string) {
    return db.delete(schema.webPushSubscriptions).where(
      and(eq(schema.webPushSubscriptions.userId, userId), eq(schema.webPushSubscriptions.endpoint, endpoint)),
    )
  }

  async deleteWebSubscriptionById(id: number) {
    return db.delete(schema.webPushSubscriptions).where(eq(schema.webPushSubscriptions.id, id))
  }

  async updatePushSettings(userId: number, settings: Partial<typeof schema.users.$inferInsert>) {
    return db.update(schema.users).set(settings).where(eq(schema.users.id, userId))
  }

  async getAllWebSubscriptionsWithUsers() {
    return db.query.webPushSubscriptions.findMany({ with: { user: true } })
  }

  async getRandomWordForPush(userId: number, nowIso: string, pushTargetDeckId?: number | null) {
    const filters: (SQL | undefined)[] = [
      eq(schema.userDictionary.userId, userId),
      lte(schema.userDictionary.due, nowIso),
    ]

    if (pushTargetDeckId) {
      filters.push(inArray(
        schema.userDictionary.id,
        db.select({ id: schema.wordToDeck.wordId })
          .from(schema.wordToDeck)
          .where(eq(schema.wordToDeck.deckId, pushTargetDeckId)),
      ))
    }

    return db.query.userDictionary.findFirst({
      where: and(...filters),
      orderBy: [sql`RANDOM()`],
    })
  }

  async updateLastPushSentAt(userId: number, lastPushSentAt: string) {
    return db.update(schema.users).set({ lastPushSentAt }).where(eq(schema.users.id, userId))
  }
}

export const pushRepository = new PushRepository()
