import { desc, eq } from 'drizzle-orm'
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

export function initScheduler() {
  // eslint-disable-next-line no-console
  console.log('🕒 Initializing background scheduler...')

  if (process.env.ENABLE_AUTO_DUMP === 'true') {
    setTimeout(checkAndRunDump, 5000)
    setInterval(checkAndRunDump, CHECK_INTERVAL_MS)
  }

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
