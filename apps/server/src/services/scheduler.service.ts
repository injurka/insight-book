/* eslint-disable no-console */
import { desc, eq } from 'drizzle-orm'
import { db } from '../db'
import * as schema from '../db/schema'
import { executeDump } from './dump.service'

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000
const CHECK_INTERVAL_MS = 60 * 60 * 1000 // Проверять каждый 1 час

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

    if (!lastDump || (now - new Date(lastDump.createdAt).getTime() > SEVEN_DAYS_MS)) {
      console.log('⏰ Time for a weekly backup! Starting dump process...')
      isDumping = true

      await executeDump()

      console.log('⏰ Weekly backup finished successfully.')
    }
  }
  catch (error) {
    console.error('❌ Error during scheduled dump:', error)
  }
  finally {
    isDumping = false
  }
}

export function initScheduler() {
  if (process.env.ENABLE_AUTO_DUMP !== 'true') {
    console.log('🕒 Background scheduler (Weekly backups) is DISABLED via env.')
    return
  }

  console.log('🕒 Initializing background scheduler (Weekly backups)...')

  setTimeout(checkAndRunDump, 5000)
  setInterval(checkAndRunDump, CHECK_INTERVAL_MS)
}
