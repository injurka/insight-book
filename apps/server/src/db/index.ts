import { existsSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { Database } from 'bun:sqlite'
import { DB_PATH, DICTS_PATH } from '../config'

const dbDir = path.dirname(DB_PATH)
mkdirSync(dbDir, { recursive: true })
mkdirSync(DICTS_PATH, { recursive: true })

export const db = new Database(DB_PATH)

db.run(`PRAGMA journal_mode = WAL`)
db.run(`PRAGMA foreign_keys = ON`)

// 1. Создание основных таблиц
db.run(`
  CREATE TABLE IF NOT EXISTS books (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    title       TEXT    NOT NULL,
    author      TEXT,
    coverBase64 TEXT,
    filePath    TEXT    NOT NULL,
    language    TEXT    NOT NULL DEFAULT 'en',
    totalPages  INTEGER NOT NULL DEFAULT 0,
    toc         TEXT,
    createdAt   TEXT    NOT NULL DEFAULT (datetime('now')),
    updatedAt   TEXT    NOT NULL DEFAULT (datetime('now'))
  )
`)

db.run(`
  CREATE TABLE IF NOT EXISTS book_pages (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    bookId   INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    pageNum  INTEGER NOT NULL,
    content  TEXT    NOT NULL,
    UNIQUE(bookId, pageNum)
  )
`)

db.run(`
  CREATE TABLE IF NOT EXISTS reading_progress (
    bookId      INTEGER PRIMARY KEY REFERENCES books(id) ON DELETE CASCADE,
    currentPage INTEGER NOT NULL DEFAULT 1,
    updatedAt   TEXT    NOT NULL DEFAULT (datetime('now'))
  )
`)

db.run(`
  CREATE TABLE IF NOT EXISTS book_stats (
    bookId      INTEGER PRIMARY KEY REFERENCES books(id) ON DELETE CASCADE,
    description TEXT,
    difficulty  TEXT,
    tags        TEXT,
    totalChars  INTEGER DEFAULT 0,
    uniqueChars INTEGER DEFAULT 0,
    createdAt   TEXT NOT NULL DEFAULT (datetime('now'))
  )
`)

db.run(`
  CREATE TABLE IF NOT EXISTS nlp_cache (
    bookId   INTEGER NOT NULL,
    pageNum  INTEGER NOT NULL,
    data     TEXT    NOT NULL,
    PRIMARY KEY (bookId, pageNum)
  )
`)

db.run(`
  CREATE TABLE IF NOT EXISTS llm_cache (
    sentenceHash TEXT PRIMARY KEY,
    sentence     TEXT NOT NULL,
    analysis     TEXT NOT NULL,
    createdAt    TEXT NOT NULL DEFAULT (datetime('now'))
  )
`)

db.run(`
  CREATE TABLE IF NOT EXISTS user_dictionary (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    word          TEXT    NOT NULL UNIQUE,
    transcription TEXT,
    translation   TEXT,
    language      TEXT    NOT NULL DEFAULT 'en',
    notes         TEXT,
    tags          TEXT,
    createdAt     TEXT    NOT NULL DEFAULT (datetime('now')),
    updatedAt     TEXT    NOT NULL DEFAULT (datetime('now'))
  )
`)

// eslint-disable-next-line no-console
console.log(`🗄️ Main SQLite Database initialized at ${DB_PATH}`)

// ============================================================================
// 2. ДИНАМИЧЕСКИЙ МЕНЕДЖЕР СЛОВАРЕЙ (STRATEGY / FACTORY)
// ============================================================================

export interface DictConnection {
  db: Database
  tableName: string
}

const dictConnections = new Map<string, DictConnection>()

export function getDictConnection(language: string): DictConnection | null {
  const lang = language.toLowerCase()

  if (dictConnections.has(lang)) {
    return dictConnections.get(lang)!
  }

  const specificPath = path.join(DICTS_PATH, `dict_${lang}.sqlite`)

  if (existsSync(specificPath)) {
    const dictDb = new Database(specificPath, { readonly: true })
    dictDb.run(`PRAGMA journal_mode = WAL`)

    const conn = { db: dictDb, tableName: 'words' }
    dictConnections.set(lang, conn)
    // eslint-disable-next-line no-console
    console.log(`📖 Loaded dictionary for [${lang}] at ${specificPath}`)
    return conn
  }

  const legacyPath = path.resolve(path.dirname(DB_PATH), 'dictionary.sqlite')
  if (lang === 'zh' && existsSync(legacyPath)) {
    const dictDb = new Database(legacyPath, { readonly: true })
    dictDb.run(`PRAGMA journal_mode = WAL`)

    const conn = { db: dictDb, tableName: 'zh_dictionary' }
    dictConnections.set(lang, conn)
    // eslint-disable-next-line no-console
    console.log(`📖 Loaded legacy Chinese dictionary at ${legacyPath}`)
    return conn
  }

  return null
}
