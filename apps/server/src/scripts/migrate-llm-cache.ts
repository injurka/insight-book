import { eq } from 'drizzle-orm'
import { db, sqlite } from '../db'
import * as schema from '../db/schema'

// Функция для генерации хэша в новом формате (БЕЗ модели)
function getNewHash(sentence: string, language: string, targetLang: string): string {
  const hasher = new Bun.CryptoHasher('sha256')
  hasher.update(`${(language || 'en').toLowerCase()}::${(targetLang || 'ru').toLowerCase()}::${sentence.trim().toLowerCase()}`)
  return hasher.digest('hex')
}

async function migrate() {
  console.log('🔍 Запуск миграции кэша LLM...')

  // Получаем все записи вместе с их привязкой к книгам
  const oldCache = await db.query.llmCache.findMany({
    with: { bookLlmCache: true },
  })

  console.log(`📦 Найдено записей для проверки: ${oldCache.length}`)

  let successCount = 0
  let skippedCount = 0
  let errorCount = 0

  for (const item of oldCache) {
    // В старой схеме мы не сохраняли целевой язык (targetLang).
    // Поскольку интерфейс у вас на русском, с вероятностью 99% это 'ru'.
    const newHash = getNewHash(item.sentence, item.language, 'ru')

    // Если хэш совпадает (вдруг запись уже в новом формате), пропускаем
    if (newHash === item.sentenceHash) {
      skippedCount++
      continue
    }

    try {
      // 1. Создаем новую запись в кэше с новым хэшом
      await db.insert(schema.llmCache).values({
        sentenceHash: newHash,
        language: item.language,
        sentence: item.sentence,
        analysis: item.analysis,
        createdAt: item.createdAt,
      }).onConflictDoNothing()

      // 2. Переносим связи с книгами (book_llm_cache)
      for (const link of item.bookLlmCache) {
        await db.insert(schema.bookLlmCache).values({
          bookId: link.bookId,
          sentenceHash: newHash,
          createdAt: link.createdAt,
        }).onConflictDoNothing()
      }

      // 3. Удаляем старую запись
      // (каскадное удаление автоматически уберет старые связи из book_llm_cache)
      await db.delete(schema.llmCache).where(eq(schema.llmCache.sentenceHash, item.sentenceHash))

      successCount++
    }
    catch (e) {
      console.error(`❌ Ошибка при переносе фразы "${item.sentence}":`, e)
      errorCount++
    }
  }

  console.log('✅ Миграция завершена!')
  console.log(`📊 Успешно обновлено: ${successCount}`)
  console.log(`⏭️ Пропущено (уже в новом формате): ${skippedCount}`)
  if (errorCount > 0)
    console.log(`⚠️ Ошибок: ${errorCount}`)
}

migrate()
  .then(() => {
    sqlite.close()
    process.exit(0)
  })
  .catch((err) => {
    console.error('Критическая ошибка:', err)
    sqlite.close()
    process.exit(1)
  })
