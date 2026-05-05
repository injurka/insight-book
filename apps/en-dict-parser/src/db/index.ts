import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { Database } from 'bun:sqlite'

const DB_PATH = path.resolve(process.cwd(), '../server/db/dicts/dict_en.sqlite')

// Убедимся, что директория для БД существует
const dbDir = path.dirname(DB_PATH)
mkdirSync(dbDir, { recursive: true })

// Создаем и экспортируем инстанс БД
export const db = new Database(DB_PATH)

// Включаем WAL-режим для лучшей производительности при одновременной записи и чтении
db.exec('PRAGMA journal_mode = WAL;')

// Создаем УНИВЕРСАЛЬНУЮ таблицу словаря, если она не существует
db.exec(`
  CREATE TABLE IF NOT EXISTS words (
    word          TEXT PRIMARY KEY,
    transcription TEXT,
    translation   TEXT
  )
`)

// Выводим сообщение в консоль
// eslint-disable-next-line no-console
console.log(`🗄️  SQLite Database initialized at ${DB_PATH}`)
