/* eslint-disable no-console */
import { existsSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'bun'
import { Database } from 'bun:sqlite'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import { BOOKS_PATH, COVERS_PATH, DB_PATH, DICTS_PATH, UPLOADS_PATH } from '../config'
import * as schema from './schema'

const dbDir = path.dirname(DB_PATH)
mkdirSync(dbDir, { recursive: true })
mkdirSync(DICTS_PATH, { recursive: true })
mkdirSync(UPLOADS_PATH, { recursive: true })
mkdirSync(BOOKS_PATH, { recursive: true })
mkdirSync(COVERS_PATH, { recursive: true })

// ============================================================================
// 0. АВТОМАТИЧЕСКАЯ СИНХРОНИЗАЦИЯ БАЗЫ ДАННЫХ
// ============================================================================
console.log('🔄 Checking and syncing database schema...')

const syncProcess = spawnSync(['bun', 'x', 'drizzle-kit', 'push', '--force'], {
  stdout: 'pipe',
  stderr: 'pipe',
})

if (syncProcess.exitCode !== 0) {
  console.error('❌ Failed to sync database schema.')

  const stdout = syncProcess.stdout?.toString().trim()
  const stderr = syncProcess.stderr?.toString().trim()

  if (stdout)
    console.error('STDOUT:', stdout)
  if (stderr)
    console.error('STDERR:', stderr)
  if (syncProcess.error)
    console.error('SYSTEM ERROR:', syncProcess.error)
}
else {
  console.log('✅ Database schema is up to date!')
}

// ============================================================================
// 1. ИНИЦИАЛИЗАЦИЯ ПОДКЛЮЧЕНИЯ
// ============================================================================
export const sqlite = new Database(DB_PATH)
sqlite.run(`PRAGMA journal_mode = WAL`)
sqlite.run(`PRAGMA foreign_keys = ON`)

export const db = drizzle(sqlite, { schema, logger: false })

console.log(`🗄️ Main SQLite Database initialized at ${DB_PATH}`)

// ============================================================================
// 3. ДИНАМИЧЕСКИЙ МЕНЕДЖЕР СЛОВАРЕЙ
// ============================================================================
export interface DictConnection {
  db: Database
  tableName: string
}

const dictConnections = new Map<string, DictConnection>()

export function getDictConnection(language: string): DictConnection | null {
  const lang = language.toLowerCase()

  if (dictConnections.has(lang))
    return dictConnections.get(lang)!

  const specificPath = path.join(DICTS_PATH, `dict_${lang}.sqlite`)

  if (existsSync(specificPath)) {
    const dictDb = new Database(specificPath, { readonly: true })
    dictDb.run(`PRAGMA journal_mode = WAL`)

    let tableName = 'words'
    if (lang === 'zh') {
      tableName = 'zh_dictionary'
    }

    try {
      const tableCheck = dictDb.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`).get(tableName)
      if (!tableCheck) {
        const fallbackCheck = dictDb.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='words'`).get()
        if (fallbackCheck) {
          tableName = 'words'
        }
        else {
          console.error(`❌ Ошибка: В словаре ${specificPath} не найдена таблица ${tableName} или words!`)
          return null
        }
      }
    }
    catch (e) {
      console.error(`❌ Ошибка проверки таблицы в словаре ${lang}:`, e)
      return null
    }

    const conn = { db: dictDb, tableName }
    dictConnections.set(lang, conn)
    console.log(`📖 Loaded dictionary for [${lang}] at ${specificPath} (Table: ${tableName})`)
    return conn
  }
  else {
    console.warn(`⚠️ Файл словаря не найден: ${specificPath}`)
  }

  return null
}

// ============================================================================
// 4. БЕЗОПАСНОЕ ЗАВЕРШЕНИЕ РАБОТЫ
// ============================================================================
function shutdown() {
  console.log('\n🛑 Shutting down server... Closing databases...')
  try {
    sqlite.close()
    for (const conn of dictConnections.values()) {
      conn.db.close()
    }
    console.log('✅ Databases closed securely.')
  }
  catch (err) {
    console.error('Error during database shutdown:', err)
  }
  process.exit(0)
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
