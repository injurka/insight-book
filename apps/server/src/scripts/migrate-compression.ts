/**
 * migrate-compression.ts
 *
 * Перезаписывает все Brotli-сжатые данные в БД в формат Zstandard (zstd).
 *
 * Затрагивает таблицы:
 *   - llm_cache   → колонка analysis (blob)
 *   - nlp_cache   → колонка data     (blob)
 *
 * Запуск:
 *   bun src/scripts/migrate-compression.ts
 */

import zlib from 'node:zlib'
import { createClient } from '@libsql/client'
import { DATABASE_AUTH_TOKEN, DATABASE_URL } from '../config'

function brotliDecompress(buf: Buffer): Buffer {
  return zlib.brotliDecompressSync(buf)
}

function zstdCompress(buf: Buffer): Buffer {
  return Bun.zstdCompressSync(buf)
}

/**
 * Пытается распаковать Brotli.
 * Если данные уже не в Brotli — возвращает null (пропустить).
 */
function tryDecompress(raw: Buffer): Buffer | null {
  try {
    return brotliDecompress(raw)
  }
  catch {
    return null
  }
}

const client = createClient({ url: DATABASE_URL, authToken: DATABASE_AUTH_TOKEN })

interface MigrateTableOptions {
  table: string
  pkCols: string[]
  dataCol: string
}

async function migrateTable({ table, pkCols, dataCol }: MigrateTableOptions) {
  console.log(`\n📦 Migrating table: ${table} (column: ${dataCol})`)

  const selectSql = `SELECT ${[...pkCols, dataCol].join(', ')} FROM ${table}`
  const rows = await client.execute(selectSql)

  let migrated = 0
  let skipped = 0
  let errors = 0

  for (const row of rows.rows) {
    const raw = row[dataCol]

    // libsql возвращает blob как Uint8Array
    if (!raw || !(raw instanceof Uint8Array)) {
      skipped++
      continue
    }

    const buf = Buffer.from(raw)
    const decompressed = tryDecompress(buf)

    if (!decompressed) {
      // Данные уже не в Brotli (возможно уже zstd или plain text)
      skipped++
      continue
    }

    try {
      const recompressed = zstdCompress(decompressed)

      // Строим WHERE по первичным ключам
      const whereParts = pkCols.map(col => `${col} = ?`).join(' AND ')
      const whereValues = pkCols.map(col => row[col])

      const updateSql = `UPDATE ${table} SET ${dataCol} = ? WHERE ${whereParts}`
      await client.execute({ sql: updateSql, args: [recompressed, ...whereValues] })

      migrated++
      if (migrated % 100 === 0)
        console.log(`  ↳ ${migrated} rows migrated...`)
    }
    catch (err) {
      errors++
      const pkInfo = pkCols.map(col => `${col}=${row[col]}`).join(', ')
      console.error(`  ✗ Failed row [${pkInfo}]:`, err)
    }
  }

  const total = rows.rows.length
  console.log(`  ✅ Done: ${migrated} migrated, ${skipped} skipped, ${errors} errors (total: ${total})`)
}

console.log('🚀 Starting Brotli → Zstd compression migration...')
console.log(`   DB: ${DATABASE_URL}`)

await migrateTable({
  table: 'llm_cache',
  pkCols: ['sentenceHash'],
  dataCol: 'analysis',
})

await migrateTable({
  table: 'nlp_cache',
  pkCols: ['bookId', 'pageNum'],
  dataCol: 'data',
})

await client.close()
console.log('\n🎉 Migration complete!')
