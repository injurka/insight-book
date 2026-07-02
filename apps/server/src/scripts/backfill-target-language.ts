import { eq } from 'drizzle-orm'
import { db } from '../db'
import * as schema from '../db/schema'

async function run() {
  console.log('Начинаем миграцию targetLanguage на основе языка оригинала...')

  const records = await db.select().from(schema.llmCache)

  console.log(`Найдено записей для миграции: ${records.length}`)

  let updatedCount = 0

  for (const record of records) {
    try {
      let targetLang = 'ru' // По умолчанию

      const sourceLang = record.language

      if (sourceLang === 'zh') {
        targetLang = 'ru'
      }
      else if (sourceLang === 'ru') {
        targetLang = 'zh'
      }
      else if (sourceLang === 'ja') {
        targetLang = 'ru'
      }
      else if (sourceLang === 'en') {
        targetLang = 'ru'
      }

      await db.update(schema.llmCache)
        .set({ targetLanguage: targetLang })
        .where(eq(schema.llmCache.sentenceHash, record.sentenceHash))

      updatedCount++
      if (updatedCount % 100 === 0) {
        console.log(`Обновлено ${updatedCount} из ${records.length}...`)
      }
    }
    catch (e) {
      console.warn(`Ошибка при обновлении записи ${record.sentenceHash}`, e)
    }
  }

  console.log(`Миграция завершена! Успешно обновлено: ${updatedCount} записей.`)
  process.exit(0)
}

run().catch(console.error)
