import { eq } from 'drizzle-orm'
import { db } from '~/db'
import { llmCache } from '~/db/schema'
import { decompressData } from '~/utils/compression'
import { logger } from '../utils/logger'

async function main() {
  logger.info('Starting cleanup of llm_cache...')

  const allCache = await db.select().from(llmCache)
  logger.info(`Found ${allCache.length} rows in llm_cache.`)

  let deletedCount = 0

  for (const row of allCache) {
    try {
      const data = JSON.parse(decompressData(row.analysis))

      // Оригинальное условие
      const hasEmptyGrammarRules = Array.isArray(data.grammarRules) && data.grammarRules.length === 0
      const hasEmptyTranscription = data.transcription === ''
      const hasEmptyTranslation = data.translation === ''
      const hasEmptyVocabulary = Array.isArray(data.vocabulary) && data.vocabulary.length === 0

      const isOriginalEmpty = hasEmptyGrammarRules && hasEmptyTranscription && hasEmptyTranslation && hasEmptyVocabulary

      // Новое условие (grammarNote и vocabularyNote)
      const isNotesEmpty = data.grammarNote === '' && data.vocabularyNote === ''

      if (isOriginalEmpty || isNotesEmpty) {
        await db.delete(llmCache).where(eq(llmCache.sentenceHash, row.sentenceHash))
        deletedCount++
      }
    }
    catch {
      // ignore JSON parse error
    }
  }

  logger.info(`Cleanup finished. Deleted ${deletedCount} rows.`)
  process.exit(0)
}

main().catch(logger.error)
