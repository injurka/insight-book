import { sql } from 'drizzle-orm'
import { db } from '../db'
import * as schema from '../db/schema'

export async function trackActivity(userId: number, type: 'added' | 'reviewed' | 'read', amount = 1) {
  const date = new Date().toISOString().split('T')[0]
  const field = type === 'added' ? 'wordsAdded' : type === 'reviewed' ? 'wordsReviewed' : 'pagesRead'

  await db.insert(schema.dailyActivity).values({
    userId,
    date,
    [field]: amount,
  }).onConflictDoUpdate({
    target: [schema.dailyActivity.userId, schema.dailyActivity.date],
    set: { [field]: sql`${schema.dailyActivity[field]} + ${amount}` },
  })
}
