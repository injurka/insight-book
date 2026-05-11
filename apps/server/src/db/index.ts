/* eslint-disable no-console */
import type { BunSQLiteDatabase } from 'drizzle-orm/bun-sqlite'
import { existsSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { isMainThread } from 'node:worker_threads'
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
// 0. АВТОМАТИЧЕСКАЯ СИНХРОНИЗАЦИЯ БАЗЫ ДАННЫХ (ТОЛЬКО В ГЛАВНОМ ПОТОКЕ)
// ============================================================================
if (isMainThread) {
  console.log('🔄 Checking and syncing database schema...')

  const syncProcess = Bun.spawnSync(['bun', 'x', 'drizzle-kit', 'push', '--force'], {
    stdout: 'pipe',
    stderr: 'pipe',
  })

  if (syncProcess.exitCode !== 0) {
    console.error('❌ Failed to sync database schema.')
    if (syncProcess.stdout)
      console.error('STDOUT:', syncProcess.stdout.toString().trim())
    if (syncProcess.stderr)
      console.error('STDERR:', syncProcess.stderr.toString().trim())
  }
  else {
    console.log('✅ Database schema is up to date!')
  }
}

// ============================================================================
// 1. ИНИЦИАЛИЗАЦИЯ ПОДКЛЮЧЕНИЯ
// ============================================================================
export const sqlite = new Database(DB_PATH)
sqlite.run(`PRAGMA journal_mode = WAL`)
sqlite.run(`PRAGMA foreign_keys = ON`)

export const db = drizzle(sqlite, { schema, logger: false })

if (isMainThread) {
  console.log(`🗄️ Main SQLite Database initialized at ${DB_PATH}`)
}

// ============================================================================
// 3. ДИНАМИЧЕСКИЙ МЕНЕДЖЕР СЛОВАРЕЙ
// ============================================================================
export interface DictConnection {
  db: Database
  dDb: BunSQLiteDatabase
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
    if (lang === 'zh')
      tableName = 'zh_dictionary'

    const dDb = drizzle(dictDb, { logger: false })
    const conn = { db: dictDb, dDb, tableName }
    dictConnections.set(lang, conn)

    if (isMainThread)
      console.log(`📖 Loaded dictionary for [${lang}] at ${specificPath}`)
    return conn
  }

  return null
}

// ============================================================================
// 4. БЕЗОПАСНОЕ ЗАВЕРШЕНИЕ РАБОТЫ
// ============================================================================
function shutdown() {
  if (isMainThread)
    console.log('\n🛑 Shutting down server... Closing databases...')
  try {
    sqlite.close()
    for (const conn of dictConnections.values()) {
      conn.db.close()
    }
  }
  catch (err) { }
  process.exit(0)
}

if (isMainThread) {
  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}
