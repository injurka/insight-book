import { readdir, readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import { catalogDb, catalogSqlite, initCatalogDb } from '../db/catalog'
import { officialDecks, officialDeckWords } from '../db/catalog-schema'
import { logger } from '../utils/logger'

const DECKS_DIR = path.resolve(process.cwd(), 'assets', 'decks')

async function exists(p: string) {
  try {
    await stat(p)
    return true
  }
  catch {
    return false
  }
}

async function seed() {
  logger.info('🌱 Начинаем импорт каталога из папки assets/decks...')

  try {
    logger.info('🗑️ Очистка старых данных каталога...')

    catalogSqlite.run(`DROP TABLE IF EXISTS official_deck_words;`)
    catalogSqlite.run(`DROP TABLE IF EXISTS official_decks;`)

    initCatalogDb()

    let subdirs: string[] = []
    try {
      const items = await readdir(DECKS_DIR, { withFileTypes: true })
      subdirs = items.filter(item => item.isDirectory()).map(item => item.name)
    }
    catch {
      logger.warn(`⚠️ Папка ${DECKS_DIR} не найдена. Создаем пустую папку...`)
      const { mkdirSync } = await import('node:fs')
      mkdirSync(DECKS_DIR, { recursive: true })
      logger.info(`✅ Создана пустая папка: ${DECKS_DIR}. Положите туда ваши JSON-колоды и запустите импорт снова.`)
      process.exit(0)
    }

    const jsonFiles: string[] = []

    for (const subdir of subdirs) {
      const subdirPath = path.join(DECKS_DIR, subdir)
      const resultPath = path.join(subdirPath, 'result')

      if (await exists(resultPath)) {
        const files = await readdir(resultPath)
        for (const file of files) {
          if (file.endsWith('.json')) {
            jsonFiles.push(path.join(resultPath, file))
          }
        }
      }
    }

    if (jsonFiles.length === 0) {
      logger.info('ℹ️ В папке assets/decks не найдено JSON-файлов для импорта.')
      process.exit(0)
    }

    logger.info(`📂 Найдено файлов для импорта: ${jsonFiles.length}`)

    for (const filePath of jsonFiles) {
      const file = path.basename(filePath)
      logger.info(`📖 Импорт файла: ${file}`)

      const raw = await readFile(filePath, 'utf-8')
      const data = JSON.parse(raw)

      if (!data.title || !data.words || !Array.isArray(data.words)) {
        logger.warn(`⚠️ Пропуск файла ${file}: отсутствует title или массив слов words.`)
        continue
      }

      const [insertedDeck] = await catalogDb.insert(officialDecks).values({
        language: data.language || data.lang || 'en',
        title: data.title,
        description: data.description || '',
        difficulty: data.difficulty || '',
        tags: Array.isArray(data.tags) ? data.tags.join(', ') : (data.tags || ''),
        wordCount: data.words.length,
      }).returning()

      const deckId = insertedDeck.id

      if (data.words.length > 0) {
        const wordsToInsert = data.words.map((w: { word?: string, transcription?: string, translation?: string, grammarNote?: string, grammarRules?: { pattern?: string, explanation?: string, example?: string }[], vocabularyNote?: string, vocabulary?: { word?: string, transcription?: string, meaning?: string, translation?: string, usageInContext?: string }[], tags?: string, difficulty?: string } | string) => {
          if (typeof w === 'string') {
            return {
              deckId,
              word: w,
              transcription: '',
              translation: '',
              grammarNote: '',
              vocabularyNote: '',
              tags: '',
              difficulty: data.difficulty || '',
            }
          }

          let grammarNote = w.grammarNote || ''
          if (!grammarNote && Array.isArray(w.grammarRules) && w.grammarRules.length > 0) {
            grammarNote = w.grammarRules.map((r) => {
              let note = `<b>${r.pattern}</b> — ${r.explanation}`
              if (r.example) {
                note += `<br><i>Пример: ${r.example}</i>`
              }
              return note
            }).join('<br><br>')
          }

          let vocabularyNote = w.vocabularyNote || ''
          if (!vocabularyNote && Array.isArray(w.vocabulary) && w.vocabulary.length > 0) {
            vocabularyNote = w.vocabulary
              .filter(v => v && v.word)
              .map((v) => {
                let note = `<b>${v.word}</b>`
                if (v.transcription) {
                  note += ` (${v.transcription})`
                }
                note += ` — ${v.meaning || v.translation || ''}`
                if (v.usageInContext) {
                  note += `<br><i>Использование: ${v.usageInContext}</i>`
                }
                return note
              })
              .join('<br><br>')
          }

          return {
            deckId,
            word: w.word,
            transcription: w.transcription || '',
            translation: w.translation || '',
            grammarNote,
            vocabularyNote,
            tags: w.tags || '',
            difficulty: w.difficulty || data.difficulty || '',
          }
        })

        const chunkSize = 500
        for (let i = 0; i < wordsToInsert.length; i += chunkSize) {
          await catalogDb.insert(officialDeckWords).values(wordsToInsert.slice(i, i + chunkSize))
        }
        logger.info(`   └─ ✅ Колода "${data.title}" импортирована успешно (${data.words.length} слов).`)
      }
    }

    logger.info('🎉 Импорт всех файлов каталога успешно завершен!')
  }
  catch (error) {
    logger.error(error, '❌ Ошибка при импорте каталога:')
  }
  finally {
    try {
      catalogSqlite.close()
    }
    catch { }
    process.exit(0)
  }
}

if (Bun.main === import.meta.path) {
  seed()
}
