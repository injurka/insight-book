import { desc, eq, sql } from 'drizzle-orm'
import { db } from '../db'
import * as schema from '../db/schema'
import { logger } from '../utils/logger'
import { executeDump } from './dump.service'
import { sendDailyMotivations } from './push.service'

const ONE_DAY_MS = 24 * 60 * 60 * 1000

let isDumping = false

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
    logger.error(error, '❌ Error during scheduled dump:')
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
      where: sql`datetime(${schema.users.periodStart}, '+1 day') <= datetime('now')`,
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

      logger.warn(`✅ Reset limits for user ${user.username}`)
    }
  }
  catch (error) {
    logger.error(error, '❌ Error during limits reset:')
  }
  finally {
    isResettingLimits = false
  }
}

export function initScheduler() {
  logger.info('🕒 Initializing background scheduler with Bun.cron...')

  if (process.env.ENABLE_AUTO_DUMP === 'true') {
    // Первоначальная проверка при старте контейнера/сервера
    setTimeout(checkAndRunDump, 5000)
    // Ежедневный авто-дамп базы данных в 03:00
    Bun.cron('0 3 * * *', checkAndRunDump)
  }

  // Проверка истечения суточных периодов пользователей каждые 15 минут
  Bun.cron('*/15 * * * *', checkAndResetLimits)

  // Проверка и рассылка мотивационных пуш-уведомлений каждые 15 минут
  Bun.cron('*/15 * * * *', async () => {
    try {
      await sendDailyMotivations()
    }
    catch (err) {
      logger.error(err)
    }
  })
}
