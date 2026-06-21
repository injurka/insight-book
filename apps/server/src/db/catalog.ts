import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { Database } from 'bun:sqlite'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import { CATALOG_DB_PATH } from '../config'
import * as catalogSchema from './catalog-schema'

const catalogDbDir = path.dirname(CATALOG_DB_PATH)
mkdirSync(catalogDbDir, { recursive: true })

export const catalogSqlite = new Database(CATALOG_DB_PATH)
catalogSqlite.run(`PRAGMA journal_mode = WAL`)
catalogSqlite.run(`PRAGMA foreign_keys = ON`)

export const catalogDb = drizzle(catalogSqlite, { schema: catalogSchema, logger: false })

export function initCatalogDb() {
  catalogSqlite.run(`
    CREATE TABLE IF NOT EXISTS official_decks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      language TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      difficulty TEXT,
      tags TEXT,
      wordCount INTEGER DEFAULT 0
    );
  `)
  catalogSqlite.run(`
    CREATE TABLE IF NOT EXISTS official_deck_words (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      deckId INTEGER REFERENCES official_decks(id),
      word TEXT NOT NULL,
      difficulty TEXT,
      tags TEXT,
      transcription TEXT,
      translation TEXT,
      grammarNote TEXT,
      vocabularyNote TEXT
    );
  `)
  catalogSqlite.run(`
    CREATE INDEX IF NOT EXISTS idx_official_deck_words_deck_id ON official_deck_words(deckId);
  `)
}