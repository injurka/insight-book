import { sqlite } from '../db'
import { sendDailyMotivations } from '../services/push.service'

const customMessage = process.argv[2]

async function main() {
  console.log('🛠️ Manually triggering push notifications...')

  if (customMessage) {
    console.log(`💬 Using custom broadcast message: "${customMessage}"`)
  }
  else {
    console.log('🤖 Using AI-generated motivations based on user progress.')
  }

  await sendDailyMotivations(customMessage)

  console.log('✅ Manual push dispatch finished.')
}

main()
  .then(() => {
    sqlite.close()
    process.exit(0)
  })
  .catch((err) => {
    console.error('\n❌ Fatal error:', err)
    sqlite.close()
    process.exit(1)
  })
