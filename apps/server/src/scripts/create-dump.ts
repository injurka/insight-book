import { executeDump } from '../services/dump.service'
import { logger } from '../utils/logger'

async function main() {
  logger.info('🛠️ Manually starting database and files dump...')

  await executeDump(msg => logger.info(msg))

  logger.info('✅ Manual dump script finished.')
  process.exit(0)
}

main().catch((err) => {
  logger.error(err, '\n❌ Fatal Dump script error:')
  process.exit(1)
})
