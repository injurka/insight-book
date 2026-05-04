import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { Database } from 'bun:sqlite'

const DB_PATH = path.resolve(process.cwd(), 'db/dictionary.sqlite')

// Убедимся, что директория для БД существует
const dbDir = path.dirname(DB_PATH)
mkdirSync(dbDir, { recursive: true })

// Создаем и экспортируем инстанс БД
export const db = new Database(DB_PATH)

// Включаем WAL-режим для лучшей производительности при одновременной записи и чтении
db.exec('PRAGMA journal_mode = WAL;')

// Создаем основную таблицу словаря, если она не существует
db.exec(`
  CREATE TABLE IF NOT EXISTS zh_dictionary (
    word        TEXT PRIMARY KEY,
    pinyin      TEXT,
    translation TEXT
  )
`)

// Выводим сообщение в консоль, что БД готова (выполнится при первом импорте этого модуля)
// eslint-disable-next-line no-console
console.log(`🗄️  SQLite Database initialized at ${DB_PATH}`)
