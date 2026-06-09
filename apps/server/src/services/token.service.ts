import { eq, sql } from 'drizzle-orm'
import { db } from '../db'
import * as schema from '../db/schema'

export function trackTokenUsage(userId: number, action: string, model: string, inputTokens: number, outputTokens: number) {
  if (!userId || (!inputTokens && !outputTokens))
    return

  const date = new Date().toISOString().split('T')[0]

  Promise.resolve().then(async () => {
    try {
      await db.insert(schema.tokenUsage).values({
        userId,
        date,
        action,
        model,
        inputTokens,
        outputTokens,
      }).onConflictDoUpdate({
        target: [schema.tokenUsage.userId, schema.tokenUsage.date, schema.tokenUsage.action, schema.tokenUsage.model],
        set: {
          inputTokens: sql`${schema.tokenUsage.inputTokens} + ${inputTokens}`,
          outputTokens: sql`${schema.tokenUsage.outputTokens} + ${outputTokens}`,
        },
      })

      await db.update(schema.users).set({
        usedTokens: sql`${schema.users.usedTokens} + ${inputTokens + outputTokens}`,
      }).where(eq(schema.users.id, userId))
    }
    catch (e) {
      console.error('[Token Tracker Error]', e)
    }
  })
}
