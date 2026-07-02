import { inArray } from 'drizzle-orm'
import { db, sqlite } from '../db'
import * as schema from '../db/schema'

// Функция проверки наличия символов нужного языка
function hasTargetLanguageScript(text: string, lang: string): boolean {
  if (!text) return false

  switch (lang) {
    case 'zh':
      // Китайские иероглифы (Han)
      return /[\u4e00-\u9fa5]/.test(text)
    case 'ru':
      // Кириллица
      return /[а-яА-ЯёЁ]/.test(text)
    case 'ja':
      // Хирагана, Катакана, Кандзи
      return /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(text)
    case 'en':
      // Латиница
      return /[a-zA-Z]/.test(text)
    default:
      // Для остальных языков пропускаем строгую проверку, считая их валидными
      return true
  }
}

async function run() {
  console.log('🔍 Начинаем проверку кэша LLM на соответствие targetLanguage...')

  // Получаем все записи из кэша
  const records = await db.select().from(schema.llmCache)
  console.log(`Всего записей в кэше: ${records.length}`)

  const toDeleteHashes: string[] = []

  for (const record of records) {
    let isValid = true

    try {
      const parsed = JSON.parse(record.analysis)
      const targetLang = record.targetLanguage

      // Собираем весь текст, который по логике должен быть на целевом языке
      const textsToCheck = [
        parsed.translation,
        ...(parsed.grammarRules || []).map((r: any) => r.explanation),
        ...(parsed.vocabulary || []).map((v: any) => v.meaning)
      ].filter(Boolean).join(' ')

      // Если текст есть, проверяем, содержит ли он символы целевого языка
      if (textsToCheck.trim().length > 0) {
        if (!hasTargetLanguageScript(textsToCheck, targetLang)) {
          isValid = false
        }
      }
    } catch (e) {
      // Если JSON невалидный (не парсится), тоже удаляем
      isValid = false
    }

    if (!isValid) {
      toDeleteHashes.push(record.sentenceHash)
    }
  }

  console.log(`❌ Найдено невалидных записей: ${toDeleteHashes.length}`)

  if (toDeleteHashes.length > 0) {
    // В SQLite есть лимит на количество параметров в выражении IN (...), поэтому удаляем чанками
    const chunkSize = 500
    let deletedCount = 0

    for (let i = 0; i < toDeleteHashes.length; i += chunkSize) {
      const chunk = toDeleteHashes.slice(i, i + chunkSize)

      await db.delete(schema.llmCache)
        .where(inArray(schema.llmCache.sentenceHash, chunk))

      deletedCount += chunk.length
      console.log(`Удалено ${deletedCount} из ${toDeleteHashes.length}...`)
    }

    console.log('✅ Невалидные записи успешно удалены!')
  } else {
    console.log('✅ Все записи в кэше валидны. Удалять нечего.')
  }
}

run()
  .then(() => {
    sqlite.close()
    process.exit(0)
  })
  .catch((err) => {
    console.error('Ошибка при проверке кэша:', err)
    sqlite.close()
    process.exit(1)
  })