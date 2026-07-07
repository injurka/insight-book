import { inArray } from 'drizzle-orm'
import { db } from '../db'
import { ttsCache } from '../db/schema'

async function run() {
  console.log('Fetching TTS cache...')
  const allCache = await db.select().from(ttsCache)

  const hashesToDelete: string[] = []

  for (const item of allCache) {
    const text = item.text.trim()

    // Эвристика для определения "слова" (не предложения):
    // 1. Нет пробелов (или это короткие идиомы, но просили именно "слов")
    // 2. Нет знаков препинания, типичных для предложений
    // 3. Разумная длина (меньше 40 символов)
    const hasSpace = text.includes(' ')
    const hasPunctuation = /[.,!?;:。！？，、\n]/.test(text)

    if (!hasSpace && !hasPunctuation && text.length <= 40) {
      hashesToDelete.push(item.textHash)
    }
  }

  if (hashesToDelete.length > 0) {
    console.log(`Found ${hashesToDelete.length} word pronunciations to delete.`)

    // Удаляем частями, чтобы не превысить лимит SQLite переменных
    const chunkSize = 500
    for (let i = 0; i < hashesToDelete.length; i += chunkSize) {
      const chunk = hashesToDelete.slice(i, i + chunkSize)
      await db.delete(ttsCache).where(inArray(ttsCache.textHash, chunk))
    }

    console.log(`Successfully deleted ${hashesToDelete.length} words from TTS cache.`)
  }
  else {
    console.log('No word pronunciations found to delete.')
  }
}

run().then(() => {
  console.log('Done.')
  process.exit(0)
}).catch((e) => {
  console.error(e)
  process.exit(1)
})
