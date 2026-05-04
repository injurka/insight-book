import { existsSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { Database } from 'bun:sqlite'
import { DB_PATH, DICT_DB_PATH } from '../config'

const dbDir = path.dirname(DB_PATH)
mkdirSync(dbDir, { recursive: true })

export const db = new Database(DB_PATH)

db.run(`PRAGMA journal_mode = WAL`)
db.run(`PRAGMA foreign_keys = ON`)

if (!existsSync(DICT_DB_PATH))
  throw new Error(`[DB Error] Файл словаря не найден по пути: ${DICT_DB_PATH}`)

export const dictDb = new Database(DICT_DB_PATH, { readonly: true })
dictDb.run(`PRAGMA journal_mode = WAL`)

db.run(`
  CREATE TABLE IF NOT EXISTS books (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    title       TEXT    NOT NULL,
    author      TEXT,
    coverBase64 TEXT,
    filePath    TEXT    NOT NULL,
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
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    word        TEXT    NOT NULL UNIQUE,
    pinyin      TEXT,
    translation TEXT,
    notes       TEXT,
    tags        TEXT,
    createdAt   TEXT    NOT NULL DEFAULT (datetime('now')),
    updatedAt   TEXT    NOT NULL DEFAULT (datetime('now'))
  )
`)

// eslint-disable-next-line no-console
console.log(`🗄️ SQLite Database initialized at ${DB_PATH}`)
// eslint-disable-next-line no-console
console.log(`📖 Dictionary Database connected at ${DICT_DB_PATH}`)
