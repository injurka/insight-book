/// <reference types="bun-types" />

/* eslint-disable no-console */
import type { BunSQLiteDatabase } from 'drizzle-orm/bun-sqlite'
import { existsSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { isMainThread } from 'node:worker_threads'
import { Database } from 'bun:sqlite'
import { eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import { migrate } from 'drizzle-orm/bun-sqlite/migrator'
import {
  ADMIN_PASSWORD,
  ADMIN_USERNAME,
  BOOKS_PATH,
  COVERS_PATH,
  DB_PATH,
  DICTS_PATH,
  UPLOADS_PATH,
} from '../config'
import * as schema from './schema'

const dbDir = path.dirname(DB_PATH)
mkdirSync(dbDir, { recursive: true })
mkdirSync(DICTS_PATH, { recursive: true })
mkdirSync(UPLOADS_PATH, { recursive: true })
mkdirSync(BOOKS_PATH, { recursive: true })
mkdirSync(COVERS_PATH, { recursive: true })

// ============================================================================
// 1. ИНИЦИАЛИЗАЦИЯ ПОДКЛЮЧЕНИЯ
// ============================================================================
export const sqlite = new Database(DB_PATH)
sqlite.run(`PRAGMA journal_mode = WAL`)
sqlite.run(`PRAGMA foreign_keys = ON`)

export const db = drizzle(sqlite, { schema, logger: false })

  // ============================================================================
  // 2. АВТОМАТИЧЕСКАЯ СИНХРОНИЗАЦИЯ БАЗЫ ДАННЫХ И ДЕФОЛТНЫЙ ЮЗЕР
  // ============================================================================
  ; (async () => {
  if (isMainThread) {
    console.log('🔄 Checking and applying database migrations...')

    try {
      // Применяем классические миграции из сгенерированных .sql файлов
      migrate(db, { migrationsFolder: path.resolve(import.meta.dir, 'migrations') })
      console.log('✅ Database migrations applied successfully!')
    }
    catch (e) {
      console.error('❌ Failed to run migrations. Check if you generated them using `bunx drizzle-kit generate`. Error:', e)
    }

    try {
      const adminExists = await db.query.users.findFirst({ where: eq(schema.users.id, 1) })

      if (!adminExists) {
        console.log('👤 Default admin user not found. Creating one...')
        const passwordHash = await Bun.password.hash(ADMIN_PASSWORD)

        await db.insert(schema.users).values({
          id: 1,
          username: ADMIN_USERNAME,
          passwordHash,
        })
        console.log(`👤 Default Admin user created (Username: ${ADMIN_USERNAME}).`)
      }
    }
    catch (e) {
      console.error('⚠️ Could not check/create admin user:', e)
    }

    console.log(`🗄️ Main SQLite Database initialized at ${DB_PATH}`)
  }
})().catch((err) => {
  console.error('❌ Critical error during database initialization:', err)
  process.exit(1)
})

// ============================================================================
// 3. ДИНАМИЧЕСКИЙ МЕНЕДЖЕР СЛОВАРЕЙ
// ============================================================================
export interface DictConnection {
  db: Database
  dDb: BunSQLiteDatabase
  tableName: string
  wordCol: string
  translationCol: string
  hasTranscription: boolean
  transcriptionCol: string
}

const dictConnections = new Map<string, DictConnection>()

export function getDictConnection(language: string, targetLanguage: string): DictConnection | null {
  const lang = language.toLowerCase()
  const target = targetLanguage.toLowerCase()
  const cacheKey = `${lang}_${target}`

  if (dictConnections.has(cacheKey))
    return dictConnections.get(cacheKey)!

  const specificPath = path.join(DICTS_PATH, `dict_${lang}_${target}.sqlite`)

  if (existsSync(specificPath)) {
    const dictDb = new Database(specificPath)
    dictDb.run(`PRAGMA journal_mode = WAL`)

    const tableQuery = dictDb.query(`SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' LIMIT 1`)
    const tableRow = tableQuery.get() as { name: string } | undefined
    if (!tableRow)
      return null
    const tableName = tableRow.name

    const columnsQuery = dictDb.query(`PRAGMA table_info("${tableName}")`)
    const columns = columnsQuery.all() as { name: string }[]
    const colNames = columns.map(c => c.name.toLowerCase())

    let wordCol = 'word'
    if (!colNames.includes('word')) {
      if (colNames.includes('term'))
        wordCol = 'term'
      else if (colNames.includes('headword'))
        wordCol = 'headword'
      else wordCol = columns[0]?.name || 'word'
    }

    let translationCol = 'translation'
    if (!colNames.includes('translation')) {
      if (colNames.includes('definition'))
        translationCol = 'definition'
      else if (colNames.includes('meaning'))
        translationCol = 'meaning'
      else if (colNames.includes('ru'))
        translationCol = 'ru'
    }

    let hasTranscription = false
    let transcriptionCol = 'transcription'

    if (colNames.includes('transcription')) {
      hasTranscription = true
      transcriptionCol = 'transcription'
    }
    else if (colNames.includes('pinyin')) {
      hasTranscription = true
      transcriptionCol = 'pinyin'
    }
    else if (colNames.includes('reading')) {
      hasTranscription = true
      transcriptionCol = 'reading'
    }
    else if (colNames.includes('pronunciation')) {
      hasTranscription = true
      transcriptionCol = 'pronunciation'
    }

    try {
      dictDb.run(`CREATE INDEX IF NOT EXISTS "idx_${tableName}_${wordCol}" ON "${tableName}" ("${wordCol}")`)
    }
    catch (e: any) {
      console.warn(`[DB Warning] Could not create index on dict_${lang}.sqlite (maybe read-only volume?):`, e.message)
    }

    const dDb = drizzle(dictDb, { logger: false })
    const conn = { db: dictDb, dDb, tableName, wordCol, translationCol, hasTranscription, transcriptionCol }
    dictConnections.set(lang, conn)

    if (isMainThread)
      console.log(`📖 Loaded dictionary for [${lang}] at ${specificPath} (Table: ${tableName})`)
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
  catch { }

  process.exit(0)
}

if (isMainThread) {
  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}
