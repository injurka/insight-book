import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { instrumentDrizzleClient } from '@kubiks/otel-drizzle'
import { createClient } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import { CATALOG_DATABASE_AUTH_TOKEN, CATALOG_DATABASE_URL, CATALOG_DB_PATH } from '../config'
import * as catalogSchema from './catalog-schema'

const catalogDbDir = path.dirname(CATALOG_DB_PATH)
mkdirSync(catalogDbDir, { recursive: true })

export const catalogClient = createClient({
  url: CATALOG_DATABASE_URL,
  authToken: CATALOG_DATABASE_AUTH_TOKEN,
})

export const catalogDb = drizzle(catalogClient, { schema: catalogSchema, logger: false })
instrumentDrizzleClient(catalogDb)

export async function initCatalogDb() {
  if (CATALOG_DATABASE_URL.startsWith('file:')) {
    await catalogClient.execute('PRAGMA journal_mode = WAL')
    await catalogClient.execute('PRAGMA synchronous = NORMAL')
    await catalogClient.execute('PRAGMA busy_timeout = 5000')
    await catalogClient.execute('PRAGMA cache_size = -64000')
    await catalogClient.execute('PRAGMA temp_store = MEMORY')
  }
  await catalogClient.execute('PRAGMA foreign_keys = ON')
  await catalogClient.batch([
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
  ])
}
