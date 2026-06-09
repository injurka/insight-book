import { and, eq } from 'drizzle-orm'
import { VAPID_PUBLIC_KEY } from '../config'
import { db } from '../db'
import * as schema from '../db/schema'
import { AppError } from '../utils/errors'
import { json } from '../utils/helpers'

export async function handleGetVapidKey(_req: Request) {
  return json({ publicKey: VAPID_PUBLIC_KEY })
}

export async function handleSubscribe(req: Request, userId: number) {
  const body = await req.json()
  const { endpoint, keys } = body
  if (!endpoint || !keys)
    throw new AppError(400, 'Invalid subscription object')

  await db.insert(schema.webPushSubscriptions).values({
    userId,
    endpoint,
    keys: JSON.stringify(keys),
  }).onConflictDoNothing()

  return json({ success: true })
}

export async function handleUnsubscribe(req: Request, userId: number) {
  const body = await req.json()
  const { endpoint } = body
  if (endpoint) {
    await db.delete(schema.webPushSubscriptions).where(
      and(eq(schema.webPushSubscriptions.userId, userId), eq(schema.webPushSubscriptions.endpoint, endpoint)),
    )
  }
  return json({ success: true })
}

export async function handleUpdatePushSettings(req: Request, userId: number) {
  const body = await req.json()
  const { targetDeckId, timeStart, timeEnd, timezone, uiLanguage } = body

  await db.update(schema.users).set({
    pushTargetDeckId: targetDeckId === 'all' || !targetDeckId ? null : targetDeckId,
    pushTimeStart: timeStart || '10:00',
    pushTimeEnd: timeEnd || '21:00',
    timezone: timezone || 'UTC',
    uiLanguage: uiLanguage || 'ru',
  }).where(eq(schema.users.id, userId))

  return json({ success: true })
}
