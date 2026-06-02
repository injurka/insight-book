import { executeDump } from '../services/dump.service'

async function main() {
  console.log('🛠️ Manually starting database and files dump...')

  await executeDump(msg => console.log(msg))

  console.log('✅ Manual dump script finished.')
  process.exit(0)
}

main().catch((err) => {
  console.error('\n❌ Fatal Dump script error:', err)
  process.exit(1)
})
