import { desc, eq, sql } from 'drizzle-orm'
import { db } from '../db'
import * as schema from '../db/schema'
import { executeDump } from './dump.service'
import { sendDailyMotivations } from './push.service'

const ONE_DAY_MS = 24 * 60 * 60 * 1000
const CHECK_INTERVAL_MS = 15 * 60 * 1000

let isDumping = false
let isPushing = false

async function checkAndRunDump() {
  if (isDumping)
    return

  try {
    const lastDump = await db.query.dumpLogs.findFirst({
      where: eq(schema.dumpLogs.status, 'success'),
      orderBy: [desc(schema.dumpLogs.createdAt)],
    })

    const now = Date.now()

    if (!lastDump || (now - new Date(lastDump.createdAt).getTime() > ONE_DAY_MS)) {
      isDumping = true
      await executeDump()
    }
  }
  catch (error) {
    console.error('❌ Error during scheduled dump:', error)
  }
  finally {
    isDumping = false
  }
}

let isResettingLimits = false

async function checkAndResetLimits() {
  if (isResettingLimits)
    return
  isResettingLimits = true
  try {
    const usersToReset = await db.query.users.findMany({
      where: sql`datetime(${schema.users.periodStart}, '+7 days') <= datetime('now')`,
    })

    for (const user of usersToReset) {
      const [{ count: usedBooks }] = await db.select({ count: sql<number>`count(*)` })
        .from(schema.books)
        .where(sql`${schema.books.userId} = ${user.id} AND datetime(${schema.books.createdAt}) >= datetime(${user.periodStart})`)

      const [{ totalTokens }] = await db.select({
        totalTokens: sql<number>`COALESCE(SUM(${schema.tokenUsage.inputTokens} + ${schema.tokenUsage.outputTokens}), 0)`.mapWith(Number),
      })
        .from(schema.tokenUsage)
        .where(sql`${schema.tokenUsage.userId} = ${user.id} AND date(${schema.tokenUsage.date}) >= date(${user.periodStart})`)

      await db.insert(schema.limitHistory).values({
        userId: user.id,
        periodStart: user.periodStart,
        periodEnd: sql`(datetime('now'))`,
        usedTokens: totalTokens,
        usedBooks,
      })

      await db.update(schema.users).set({
        periodStart: sql`(datetime('now'))`,
        usedTokens: 0,
      }).where(eq(schema.users.id, user.id))

      console.warn(`✅ Reset limits for user ${user.username}`)
    }
  }
  catch (error) {
    console.error('❌ Error during limits reset:', error)
  }
  finally {
    isResettingLimits = false
  }
}

export function initScheduler() {
  // eslint-disable-next-line no-console
  console.log('🕒 Initializing background scheduler...')

  if (process.env.ENABLE_AUTO_DUMP === 'true') {
    setTimeout(checkAndRunDump, 5000)
    setInterval(checkAndRunDump, CHECK_INTERVAL_MS)
  }

  setInterval(checkAndResetLimits, CHECK_INTERVAL_MS)

  setInterval(async () => {
    if (isPushing)
      return
    isPushing = true
    try {
      await sendDailyMotivations()
    }
    catch (err) {
      console.error(err)
    }
    finally {
      isPushing = false
    }
  }, CHECK_INTERVAL_MS)
}
