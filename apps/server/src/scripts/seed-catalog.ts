import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { officialDecks, officialDeckWords } from '../db/catalog-schema'

import { catalogDb, catalogSqlite, initCatalogDb } from '../db/catalog'

const DECKS_DIR = path.resolve(process.cwd(), 'assets', 'decks')

async function seed() {
  console.log('🌱 Начинаем импорт каталога из папки assets/decks...')

  try {
    console.log('🗑️ Очистка старых данных каталога...')

    catalogSqlite.run(`DROP TABLE IF EXISTS official_deck_words;`)
    catalogSqlite.run(`DROP TABLE IF EXISTS official_decks;`)

    initCatalogDb()

    let files: string[] = []
    try {
      files = await readdir(DECKS_DIR)
    }
    catch {
      console.warn(`⚠️ Папка ${DECKS_DIR} не найдена. Создаем пустую папку...`)
      const { mkdirSync } = await import('node:fs')
      mkdirSync(DECKS_DIR, { recursive: true })
      console.log(`✅ Создана пустая папка: ${DECKS_DIR}. Положите туда ваши JSON-колоды и запустите импорт снова.`)
      process.exit(0)
    }

    const jsonFiles = files.filter(f => f.endsWith('.json'))

    if (jsonFiles.length === 0) {
      console.log('ℹ️ В папке assets/decks не найдено JSON-файлов для импорта.')
      process.exit(0)
    }

    console.log(`📂 Найдено файлов для импорта: ${jsonFiles.length}`)

    for (const file of jsonFiles) {
      const filePath = path.join(DECKS_DIR, file)
      console.log(`📖 Импорт файла: ${file}`)

      const raw = await readFile(filePath, 'utf-8')
      const data = JSON.parse(raw)

      if (!data.title || !data.words || !Array.isArray(data.words)) {
        console.warn(`⚠️ Пропуск файла ${file}: отсутствует title или массив слов words.`)
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
        const wordsToInsert = data.words.map((w: any) => ({
          deckId,
          word: w.word,
          transcription: w.transcription || '',
          translation: w.translation || '',
          grammarNote: w.grammarNote || '',
          vocabularyNote: w.vocabularyNote || '',
          tags: w.tags || '',
          difficulty: w.difficulty || '',
        }))

        const chunkSize = 500
        for (let i = 0; i < wordsToInsert.length; i += chunkSize) {
          await catalogDb.insert(officialDeckWords).values(wordsToInsert.slice(i, i + chunkSize))
        }
        console.log(`   └─ ✅ Колода "${data.title}" импортирована успешно (${data.words.length} слов).`)
      }
    }

    console.log('🎉 Импорт всех файлов каталога успешно завершен!')
  }
  catch (error) {
    console.error('❌ Ошибка при импорте каталога:', error)
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
