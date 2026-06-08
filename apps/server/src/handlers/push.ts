import { eq, and } from 'drizzle-orm'
import { VAPID_PUBLIC_KEY } from '../config'
import { db } from '../db'
import * as schema from '../db/schema'
import { json } from '../utils/helpers'

export async function handleGetVapidKey(req: Request) {
  return json({ publicKey: VAPID_PUBLIC_KEY })
}

export async function handleSubscribe(req: Request, userId: number) {
  const body = await req.json()
  const { endpoint, keys } = body

  if (!endpoint || !keys) {
    return json({ error: 'Invalid subscription object' }, 400)
  }

  await db.insert(schema.webPushSubscriptions).values({
    userId,
    endpoint,
    keys: JSON.stringify(keys)
  }).onConflictDoNothing()

  return json({ success: true })
}

export async function handleUnsubscribe(req: Request, userId: number) {
  const body = await req.json()
  const { endpoint } = body

  if (endpoint) {
    await db.delete(schema.webPushSubscriptions).where(
      and(
        eq(schema.webPushSubscriptions.userId, userId),
        eq(schema.webPushSubscriptions.endpoint, endpoint)
      )
    )
  }
  return json({ success: true })
}