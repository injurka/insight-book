import type { InArgs } from '@libsql/client'
import { createClient } from '@libsql/client'
import { Database } from 'bun:sqlite'
import { CATALOG_DATABASE_AUTH_TOKEN, CATALOG_DATABASE_URL, CATALOG_DB_PATH } from '../config'
import { logger } from '../utils/logger'

async function withRetry<T>(fn: () => Promise<T>, maxRetries = 5, delayMs = 2000): Promise<T> {
  let attempt = 0
  while (attempt < maxRetries) {
    try {
      return await fn()
    }
    catch (err) {
      attempt++
      if (attempt >= maxRetries)
        throw err
      logger.warn(`⚠️ Request failed. Retrying attempt ${attempt}/${maxRetries} after ${delayMs}ms...`)
      await new Promise(r => setTimeout(r, delayMs))
      delayMs *= 1.5
    }
  }
  throw new Error('Unreachable')
}

async function main() {
  logger.info('--------------------------------------------------')
  logger.info('🚀 Starting migration of catalog database...')
  logger.info(`Local SQLite source: ${CATALOG_DB_PATH}`)
  logger.info(`Target LibSQL: ${CATALOG_DATABASE_URL}`)
  logger.info('--------------------------------------------------')

  if (!CATALOG_DATABASE_URL.startsWith('libsql://') && !CATALOG_DATABASE_URL.startsWith('https://')) {
    logger.error('❌ CATALOG_DATABASE_URL must start with libsql:// or https:// to migrate to remote BunnyDB.')
    process.exit(1)
  }

  const localDb = new Database(CATALOG_DB_PATH)
  const remoteClient = createClient({
    url: CATALOG_DATABASE_URL,
    authToken: CATALOG_DATABASE_AUTH_TOKEN,
  })

  // Ensure tables exist on remote
  logger.info('🔄 Initializing remote catalog tables...')
  await withRetry(() => remoteClient.batch([
    `CREATE TABLE IF NOT EXISTS official_decks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      language TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      difficulty TEXT,
      tags TEXT,
      wordCount INTEGER DEFAULT 0
    )`,
    `CREATE TABLE IF NOT EXISTS official_deck_words (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      deckId INTEGER REFERENCES official_decks(id),
      word TEXT NOT NULL,
      difficulty TEXT,
      tags TEXT,
      transcription TEXT,
      translation TEXT,
      grammarNote TEXT,
      vocabularyNote TEXT
    )`,
    `CREATE INDEX IF NOT EXISTS idx_official_deck_words_deck_id ON official_deck_words(deckId)`,
  ]))

  // Clear existing remote data
  logger.info('🧹 Clearing existing remote catalog tables...')
  await withRetry(() => remoteClient.execute('DELETE FROM official_deck_words'))
  await withRetry(() => remoteClient.execute('DELETE FROM official_decks'))

  // Migrate official_decks
  logger.info('🔄 Migrating official_decks...')
  const decks = localDb.query('SELECT * FROM official_decks').all() as Record<string, unknown>[]
  if (decks.length > 0) {
    const columns = Object.keys(decks[0])
    const columnsJoined = columns.map(c => `"${c}"`).join(', ')
    const placeholders = columns.map(() => '?').join(', ')
    const sql = `INSERT INTO official_decks (${columnsJoined}) VALUES (${placeholders})`

    const chunkSize = 100
    for (let i = 0; i < decks.length; i += chunkSize) {
      const chunk = decks.slice(i, i + chunkSize)
      const statements = chunk.map(row => ({
        sql,
        args: columns.map(col => row[col]) as InArgs,
      }))
      await withRetry(() => remoteClient.batch(statements, 'write'))
    }
    logger.info(`✅ Migrated ${decks.length} decks.`)
  }
  else {
    logger.info('ℹ️ No decks found to migrate.')
  }

  // Migrate official_deck_words
  logger.info('🔄 Migrating official_deck_words...')
  const words = localDb.query('SELECT * FROM official_deck_words').all() as Record<string, unknown>[]
  if (words.length > 0) {
    const columns = Object.keys(words[0])
    const columnsJoined = columns.map(c => `"${c}"`).join(', ')
    const placeholders = columns.map(() => '?').join(', ')
    const sql = `INSERT INTO official_deck_words (${columnsJoined}) VALUES (${placeholders})`

    const chunkSize = 200
    for (let i = 0; i < words.length; i += chunkSize) {
      const chunk = words.slice(i, i + chunkSize)
      const statements = chunk.map(row => ({
        sql,
        args: columns.map(col => row[col]) as InArgs,
      }))
      await withRetry(() => remoteClient.batch(statements, 'write'))
      if ((i + chunkSize) % 2000 === 0 || i + chunkSize >= words.length) {
        logger.info(`   Progress: ${Math.min(i + chunkSize, words.length)} / ${words.length} words processed.`)
      }
    }
    logger.info(`✅ Migrated ${words.length} words.`)
  }
  else {
    logger.info('ℹ️ No words found to migrate.')
  }

  localDb.close()
  remoteClient.close()
  logger.info('🎉 Catalog database migration completed successfully!')
}

main().catch((err) => {
  logger.error(err, '❌ Catalog database migration failed:')
  process.exit(1)
})
