import { sqlite } from '../db'
import { sendDailyMotivations } from '../services/push.service'
import { logger } from '../utils/logger'

const customMessage = process.argv[2]

async function main() {
  logger.info('🛠️ Manually triggering push notifications...')

  if (customMessage) {
    logger.info(`💬 Using custom broadcast message: "${customMessage}"`)
  }
  else {
    logger.info('🤖 Using AI-generated motivations based on user progress.')
  }

  await sendDailyMotivations(customMessage)

  logger.info('✅ Manual push dispatch finished.')
}

main()
  .then(() => {
    sqlite.close()
    process.exit(0)
  })
  .catch((err) => {
    logger.error(err, '\n❌ Fatal error:')
    sqlite.close()
    process.exit(1)
  })
