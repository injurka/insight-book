import type { InArgs, InStatement } from '@libsql/client'
import { createClient } from '@libsql/client'
import { Database } from 'bun:sqlite'
import { DATABASE_AUTH_TOKEN, DATABASE_URL, DB_PATH } from '../config'
import { logger } from '../utils/logger'

const PRIORITY_ORDER = [
  'users',
  'custom_prompts',
  'opds_catalogs',
  'catalog_plugins',
  'user_plugins',
  'fcm_subscriptions',
  'web_push_subscriptions',
  'email_confirmations',
  'limit_history',
  'dump_logs',
  'daily_activity',
  'books',
  'book_pages',
  'manga_pages',
  'book_stats',
  'reading_progress',
  'highlights',
  'pregenerated_questions',
  'user_quiz_progress',
  'dict_decks',
  'user_dictionary',
  'word_to_deck',
  'word_encounters',
  'nlp_cache',
  'tts_cache',
  'llm_cache',
  'book_llm_cache',
  'book_tts_cache',
  'token_usage',
  'llm_logs',
]

async function withRetry<T>(fn: () => Promise<T>, maxRetries = 5, delayMs = 2000): Promise<T> {
  let attempt = 0
  while (attempt < maxRetries) {
    try {
      return await fn()
    }
    catch (err) {
      const error = err as Error
      const isIgnorable = error.message.includes('already exists') || error.message.includes('duplicate column')
      if (isIgnorable)
        throw err
      attempt++
      if (attempt >= maxRetries)
        throw err
      logger.warn(`⚠️ Request failed (${error.message}). Retrying attempt ${attempt}/${maxRetries} after ${delayMs}ms...`)
      await new Promise(r => setTimeout(r, delayMs))
      delayMs *= 1.5
    }
  }
  throw new Error('Unreachable')
}

async function main() {
  logger.info(`--------------------------------------------------`)
  logger.info(`🚀 Starting migration of main database (insight-book)...`)
  logger.info(`Local SQLite source: ${DB_PATH}`)
  logger.info(`Target LibSQL (BunnyDB): ${DATABASE_URL}`)
  logger.info(`--------------------------------------------------`)

  if (!DATABASE_URL.startsWith('libsql://') && !DATABASE_URL.startsWith('https://')) {
    logger.error('❌ DATABASE_URL in .env must start with libsql:// or https:// to migrate to remote BunnyDB.')
    process.exit(1)
  }

  const localDb = new Database(DB_PATH)
  const remoteClient = createClient({
    url: DATABASE_URL,
    authToken: DATABASE_AUTH_TOKEN,
  })

  // Disable foreign key checks for schema creation and clean table wipe
  try {
    await remoteClient.execute('PRAGMA foreign_keys = OFF;')
  }
  catch {
    // BunnyDB / HTTP proxy may ignore PRAGMA
  }

  // Step 0: Clean wipe of the remote database (drop all tables)
  logger.info('🧹 Dropping all existing tables on remote BunnyDB for a clean migration...')
  try {
    const remoteTablesResult = await remoteClient.execute(
      'SELECT name FROM sqlite_master WHERE type=\'table\' AND name NOT LIKE \'sqlite_%\' AND name NOT LIKE \'_litestream_%\'',
    )
    for (const row of remoteTablesResult.rows) {
      const tableName = row.name as string
      logger.info(`   Dropping table "${tableName}"...`)
      try {
        await remoteClient.execute(`DROP TABLE IF EXISTS "${tableName}"`)
      }
      catch (err) {
        const error = err as Error
        if (!error.message.includes('no such table')) {
          logger.warn(`⚠️ Warning dropping table ${tableName}: ${error.message}`)
        }
      }
    }
    logger.info('✅ Remote database cleared.')
  }
  catch (err) {
    const error = err as Error
    logger.warn(`⚠️ Failed to drop some tables: ${error.message}`)
  }

  // Step 1: Ensure remote database tables and schema are created directly
  logger.info('🔄 Creating current schema tables on remote BunnyDB...')

  // Применяем последний актуальный SQL схемы напрямую через drizzle-kit или drizzle migrate
  // Но так как нам нужна чистая база, достаточно запустить актуальный push
  const schemaStatements = [
    `CREATE TABLE IF NOT EXISTS dump_logs (id integer PRIMARY KEY AUTOINCREMENT NOT NULL, prefix text NOT NULL, status text DEFAULT 'in-progress' NOT NULL, error text, createdAt text DEFAULT (datetime('now')) NOT NULL, completedAt text);`,
    `CREATE TABLE IF NOT EXISTS users (id integer PRIMARY KEY AUTOINCREMENT NOT NULL, username text NOT NULL UNIQUE, passwordHash text NOT NULL, role text DEFAULT 'user' NOT NULL, subscriptionTier text DEFAULT 'free' NOT NULL, tokenLimit integer DEFAULT 100000, bookLimit integer DEFAULT 3, usedTokens integer DEFAULT 0 NOT NULL, periodStart text DEFAULT (datetime('now')) NOT NULL, createdAt text DEFAULT (datetime('now')) NOT NULL, pushTargetDeckId integer, pushTimeStart text DEFAULT '10:00' NOT NULL, pushTimeEnd text DEFAULT '21:00' NOT NULL, pushCount integer DEFAULT 1 NOT NULL, timezone text DEFAULT 'UTC' NOT NULL, uiLanguage text DEFAULT 'ru' NOT NULL, lastPushSentAt text, avatarUrl text, email text UNIQUE, yandexId text UNIQUE);`,
    `CREATE TABLE IF NOT EXISTS email_confirmations (id integer PRIMARY KEY AUTOINCREMENT NOT NULL, email text NOT NULL, code text NOT NULL, createdAt text DEFAULT (datetime('now')) NOT NULL);`,
    `CREATE TABLE IF NOT EXISTS limit_history (id integer PRIMARY KEY AUTOINCREMENT NOT NULL, userId integer NOT NULL REFERENCES users(id) ON DELETE cascade, periodStart text NOT NULL, periodEnd text NOT NULL, usedTokens integer DEFAULT 0 NOT NULL, usedBooks integer DEFAULT 0 NOT NULL);`,
    `CREATE TABLE IF NOT EXISTS token_usage (id integer PRIMARY KEY AUTOINCREMENT NOT NULL, userId integer NOT NULL REFERENCES users(id) ON DELETE cascade, date text NOT NULL, action text NOT NULL, model text NOT NULL, inputTokens integer DEFAULT 0 NOT NULL, outputTokens integer DEFAULT 0 NOT NULL, UNIQUE(userId, date, action, model));`,
    `CREATE TABLE IF NOT EXISTS llm_logs (id integer PRIMARY KEY AUTOINCREMENT NOT NULL, userId integer NOT NULL REFERENCES users(id) ON DELETE cascade, action text NOT NULL, model text NOT NULL, inputTokens integer DEFAULT 0 NOT NULL, outputTokens integer DEFAULT 0 NOT NULL, inputText text, outputText text, createdAt text DEFAULT (datetime('now')) NOT NULL);`,
    `CREATE TABLE IF NOT EXISTS books (id integer PRIMARY KEY AUTOINCREMENT NOT NULL, userId integer DEFAULT 1 NOT NULL REFERENCES users(id) ON DELETE cascade, type text DEFAULT 'epub' NOT NULL, title text NOT NULL, author text, coverUrl text, filePath text NOT NULL, language text DEFAULT 'en' NOT NULL, totalPages integer DEFAULT 0 NOT NULL, toc text, series text, seriesNumber integer, isPublic integer DEFAULT 0 NOT NULL, publicStatus text DEFAULT 'private' NOT NULL, textDirection text, createdAt text DEFAULT (datetime('now')) NOT NULL, updatedAt text DEFAULT (datetime('now')) NOT NULL);`,
    `CREATE TABLE IF NOT EXISTS manga_pages (id integer PRIMARY KEY AUTOINCREMENT NOT NULL, bookId integer NOT NULL REFERENCES books(id) ON DELETE cascade, pageNum integer NOT NULL, imageUrl text NOT NULL, imageWidth integer NOT NULL, imageHeight integer NOT NULL, ocrData text, UNIQUE(bookId, pageNum));`,
    `CREATE TABLE IF NOT EXISTS book_pages (id integer PRIMARY KEY AUTOINCREMENT NOT NULL, bookId integer NOT NULL REFERENCES books(id) ON DELETE cascade, pageNum integer NOT NULL, content text NOT NULL, UNIQUE(bookId, pageNum));`,
    `CREATE TABLE IF NOT EXISTS reading_progress (bookId integer NOT NULL REFERENCES books(id) ON DELETE cascade, userId integer DEFAULT 1 NOT NULL REFERENCES users(id) ON DELETE cascade, currentPage integer DEFAULT 1 NOT NULL, status text DEFAULT 'reading' NOT NULL, isFavorite integer DEFAULT 0 NOT NULL, collection text, updatedAt text DEFAULT (datetime('now')) NOT NULL, PRIMARY KEY(bookId, userId));`,
    `CREATE TABLE IF NOT EXISTS book_stats (bookId integer PRIMARY KEY NOT NULL REFERENCES books(id) ON DELETE cascade, description text, difficulty text, tags text, totalChars integer DEFAULT 0, uniqueChars integer DEFAULT 0, totalSentences integer DEFAULT 0, totalWords integer DEFAULT 0, posDistribution text, topWords text, lexicalDiversity integer, createdAt text DEFAULT (datetime('now')) NOT NULL);`,
    `CREATE TABLE IF NOT EXISTS nlp_cache (bookId integer NOT NULL, pageNum integer NOT NULL, data blob NOT NULL);`,
    `CREATE TABLE IF NOT EXISTS llm_cache (sentenceHash text PRIMARY KEY NOT NULL, language text DEFAULT 'en' NOT NULL, sentence text NOT NULL, analysis blob NOT NULL, targetLanguage text DEFAULT 'ru' NOT NULL, createdAt text DEFAULT (datetime('now')) NOT NULL);`,
    `CREATE TABLE IF NOT EXISTS book_llm_cache (bookId integer NOT NULL REFERENCES books(id) ON DELETE cascade, sentenceHash text NOT NULL REFERENCES llm_cache(sentenceHash) ON DELETE cascade, type text DEFAULT 'sentence' NOT NULL, createdAt text DEFAULT (datetime('now')) NOT NULL, PRIMARY KEY(bookId, sentenceHash));`,
    `CREATE TABLE IF NOT EXISTS tts_cache (textHash text PRIMARY KEY NOT NULL, text text NOT NULL, audioBlob blob NOT NULL, createdAt text DEFAULT (datetime('now')) NOT NULL);`,
    `CREATE TABLE IF NOT EXISTS book_tts_cache (bookId integer NOT NULL REFERENCES books(id) ON DELETE cascade, textHash text NOT NULL REFERENCES tts_cache(textHash) ON DELETE cascade, createdAt text DEFAULT (datetime('now')) NOT NULL, PRIMARY KEY(bookId, textHash));`,
    `CREATE TABLE IF NOT EXISTS dict_decks (id integer PRIMARY KEY AUTOINCREMENT NOT NULL, userId integer NOT NULL REFERENCES users(id) ON DELETE cascade, name text NOT NULL, language text DEFAULT 'en' NOT NULL, targetLanguage text DEFAULT 'ru' NOT NULL, createdAt text DEFAULT (datetime('now')) NOT NULL);`,
    `CREATE TABLE IF NOT EXISTS opds_catalogs (id integer PRIMARY KEY AUTOINCREMENT NOT NULL, userId integer NOT NULL REFERENCES users(id) ON DELETE cascade, title text NOT NULL, url text NOT NULL, createdAt text DEFAULT (datetime('now')) NOT NULL);`,
    `CREATE TABLE IF NOT EXISTS user_dictionary (id integer PRIMARY KEY AUTOINCREMENT NOT NULL, userId integer DEFAULT 1 NOT NULL REFERENCES users(id) ON DELETE cascade, word text NOT NULL, transcription text, translation text, language text DEFAULT 'en' NOT NULL, targetLanguage text DEFAULT 'ru' NOT NULL, notes text, tags text, difficulty text, grammarNote text, vocabularyNote text, state integer DEFAULT 0 NOT NULL, due text DEFAULT (datetime('now')) NOT NULL, stability real DEFAULT 0 NOT NULL, difficultyFsrs real DEFAULT 0 NOT NULL, scheduledDays integer DEFAULT 0 NOT NULL, reps integer DEFAULT 0 NOT NULL, lapses integer DEFAULT 0 NOT NULL, lastReview text, learningSteps integer DEFAULT 0 NOT NULL, createdAt text DEFAULT (datetime('now')) NOT NULL, updatedAt text DEFAULT (datetime('now')) NOT NULL, UNIQUE(userId, word, targetLanguage));`,
    `CREATE TABLE IF NOT EXISTS word_to_deck (wordId integer NOT NULL REFERENCES user_dictionary(id) ON DELETE cascade, deckId integer NOT NULL REFERENCES dict_decks(id) ON DELETE cascade, PRIMARY KEY(wordId, deckId));`,
    `CREATE TABLE IF NOT EXISTS word_encounters (id integer PRIMARY KEY AUTOINCREMENT NOT NULL, userId integer NOT NULL REFERENCES users(id) ON DELETE cascade, wordId integer NOT NULL REFERENCES user_dictionary(id) ON DELETE cascade, bookId integer REFERENCES books(id) ON DELETE set null, sentence text NOT NULL, createdAt text DEFAULT (datetime('now')) NOT NULL, UNIQUE(wordId, sentence));`,
    `CREATE TABLE IF NOT EXISTS daily_activity (id integer PRIMARY KEY AUTOINCREMENT NOT NULL, userId integer NOT NULL REFERENCES users(id) ON DELETE cascade, date text NOT NULL, wordsAdded integer DEFAULT 0 NOT NULL, wordsReviewed integer DEFAULT 0 NOT NULL, pagesRead integer DEFAULT 0 NOT NULL, UNIQUE(userId, date));`,
    `CREATE TABLE IF NOT EXISTS web_push_subscriptions (id integer PRIMARY KEY AUTOINCREMENT NOT NULL, userId integer NOT NULL REFERENCES users(id) ON DELETE cascade, endpoint text NOT NULL UNIQUE, keys text NOT NULL, createdAt text DEFAULT (datetime('now')) NOT NULL);`,
    `CREATE TABLE IF NOT EXISTS highlights (id integer PRIMARY KEY AUTOINCREMENT NOT NULL, userId integer NOT NULL REFERENCES users(id) ON DELETE cascade, bookId integer NOT NULL REFERENCES books(id) ON DELETE cascade, text text NOT NULL, translation text, note text, color text DEFAULT '#fde047' NOT NULL, chapter text, pageNum integer NOT NULL, analysisData text, createdAt text DEFAULT (datetime('now')) NOT NULL);`,
    `CREATE TABLE IF NOT EXISTS custom_prompts (id integer PRIMARY KEY AUTOINCREMENT NOT NULL, userId integer NOT NULL REFERENCES users(id) ON DELETE cascade, name text NOT NULL, prompt text NOT NULL, createdAt text DEFAULT (datetime('now')) NOT NULL, updatedAt text DEFAULT (datetime('now')) NOT NULL);`,
    `CREATE TABLE IF NOT EXISTS user_quiz_progress (id integer PRIMARY KEY AUTOINCREMENT NOT NULL, userId integer NOT NULL REFERENCES users(id) ON DELETE cascade, language text NOT NULL, levelValue text NOT NULL, bestScore integer DEFAULT 0 NOT NULL, stars integer DEFAULT 0 NOT NULL, unlocked integer DEFAULT 0 NOT NULL, updatedAt text DEFAULT (datetime('now')) NOT NULL);`,
    `CREATE TABLE IF NOT EXISTS pregenerated_questions (id integer PRIMARY KEY AUTOINCREMENT NOT NULL, language text NOT NULL, levelValue text NOT NULL, questionType text NOT NULL, questionData text NOT NULL, createdAt text DEFAULT (datetime('now')) NOT NULL);`,
    `CREATE TABLE IF NOT EXISTS user_plugins (userId integer NOT NULL REFERENCES users(id) ON DELETE cascade, pluginId text NOT NULL, manifestUrl text NOT NULL, settings text, isEnabled integer DEFAULT 1 NOT NULL, createdAt text DEFAULT (datetime('now')) NOT NULL, PRIMARY KEY(userId, pluginId));`,
    `CREATE TABLE IF NOT EXISTS catalog_plugins (id text PRIMARY KEY NOT NULL, name text NOT NULL, version text NOT NULL, description text, icon text, author text, sourceUrl text, manifestUrl text NOT NULL, uploadedBy integer REFERENCES users(id) ON DELETE set null, status text DEFAULT 'pending' NOT NULL, createdAt text DEFAULT (datetime('now')) NOT NULL, updatedAt text DEFAULT (datetime('now')) NOT NULL);`,
  ]

  for (const statement of schemaStatements) {
    try {
      await remoteClient.execute(statement)
    }
    catch (err) {
      const error = err as Error
      logger.warn(`⚠️ Warning executing statement: ${error.message}`)
    }
  }
  logger.info('✅ Remote database schema created.')

  // Step 2: Get user tables from local SQLite
  const localTablesResult = localDb
    .query('SELECT name FROM sqlite_master WHERE type=\'table\' AND name NOT LIKE \'sqlite_%\' AND name NOT LIKE \'_litestream_%\' AND name != \'__drizzle_migrations\'')
    .all() as { name: string }[]

  const foundTablesSet = new Set(localTablesResult.map(t => t.name))

  // Sort tables according to priority
  const tablesToMigrate: string[] = []
  for (const t of PRIORITY_ORDER) {
    if (foundTablesSet.has(t)) {
      tablesToMigrate.push(t)
      foundTablesSet.delete(t)
    }
  }
  for (const t of foundTablesSet) {
    tablesToMigrate.push(t)
  }

  // Step 3: Clear remote tables in REVERSE priority order to preserve foreign key constraints logic
  logger.info('🧹 Clearing target database tables before data dump...')
  const reverseTables = [...tablesToMigrate].reverse()
  for (const table of reverseTables) {
    try {
      await remoteClient.execute(`DELETE FROM "${table}"`)
    }
    catch (e) {
      const error = e as Error
      logger.warn(`⚠️ Note when clearing remote table "${table}": ${error.message}`)
    }
  }

  // Step 4: Transfer rows table by table in priority order
  for (const table of tablesToMigrate) {
    logger.info(`\n🔄 Migrating table "${table}"...`)

    const rows = localDb.query(`SELECT * FROM "${table}"`).all() as Record<string, unknown>[]
    if (rows.length === 0) {
      logger.info(`ℹ️ Table "${table}" is empty. Skipping rows.`)
      continue
    }

    const columns = Object.keys(rows[0])
    const columnsJoined = columns.map(c => `"${c}"`).join(', ')
    const placeholders = columns.map(() => '?').join(', ')
    const sql = `INSERT INTO "${table}" (${columnsJoined}) VALUES (${placeholders})`

    let insertedRowsCount = 0
    let skippedOrphansCount = 0

    const chunkSize = 200
    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunk = rows.slice(i, i + chunkSize)
      const statements: InStatement[] = chunk.map(row => ({
        sql,
        args: columns.map(col => row[col]) as InArgs,
      }))

      try {
        await withRetry(() => remoteClient.batch(statements, 'write'))
        insertedRowsCount += chunk.length
      }
      catch (err) {
        const error = err as Error
        if (error.message?.includes('FOREIGN KEY constraint failed')) {
          // Fallback: Insert row by row to retain valid rows
          for (const row of chunk) {
            try {
              await remoteClient.execute({
                sql,
                args: columns.map(col => row[col]) as InArgs,
              })
              insertedRowsCount++
            }
            catch (singleErr) {
              const singleError = singleErr as Error
              if (singleError.message?.includes('FOREIGN KEY constraint failed') || singleError.message?.includes('database is locked')) {
                skippedOrphansCount++
              }
              else {
                logger.warn(`⚠️ Skipping row due to error: ${singleError.message}`)
                skippedOrphansCount++
              }
            }
          }
        }
        else {
          throw err
        }
      }

      if ((i + chunkSize) % 2000 === 0 || i + chunkSize >= rows.length) {
        logger.info(`   Progress: ${Math.min(i + chunkSize, rows.length)} / ${rows.length} rows processed.`)
      }
    }

    if (skippedOrphansCount > 0) {
      logger.info(`✅ Successfully migrated ${insertedRowsCount} rows for table "${table}" (${skippedOrphansCount} orphaned local rows skipped).`)
    }
    else {
      logger.info(`✅ Successfully migrated ${insertedRowsCount} rows for table "${table}".`)
    }
  }

  localDb.close()
  remoteClient.close()
  logger.info(`\n🎉 Data migration to BunnyDB completed successfully!`)
}

main().catch((err) => {
  logger.error(err, '\n❌ Migration failed with error:')
  process.exit(1)
})
