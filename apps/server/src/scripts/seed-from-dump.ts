import { mkdir, rm } from 'node:fs/promises'
import path from 'node:path'
import { DB_PATH } from '../config'
import { storageService } from '../services/storage.service'

const args = process.argv.slice(2)
const specificDump = args[0] // Например: dumps/2026-06-02T12-00-00/

async function main() {
  console.log('⚠️  WARNING: Restoring from a dump will overwrite current database and uploads.')

  let dumpPrefixToUse = specificDump

  if (!dumpPrefixToUse) {
    console.log('🔍 No specific dump provided. Finding the latest one...')
    const dumps = await storageService.listDumpFolders('dumps')
    if (dumps.length === 0) {
      console.error('❌ No dumps found in S3.')
      process.exit(1)
    }
    // Сортируем по имени (т.к. у нас формат ISO 8601, сортировка по алфавиту работает идеально)
    dumps.sort()
    dumpPrefixToUse = dumps[dumps.length - 1]
  }

  // Убеждаемся, что префикс заканчивается на /
  if (!dumpPrefixToUse.endsWith('/')) {
    dumpPrefixToUse += '/'
  }

  console.log(`📦 Using dump: ${dumpPrefixToUse}`)

  const s3Keys = await storageService.listFilesInFolder(dumpPrefixToUse)
  if (s3Keys.length === 0) {
    console.error('❌ No files found in this dump.')
    process.exit(1)
  }

  console.log(`📥 Restoring ${s3Keys.length} files...`)

  // Удаляем старые WAL файлы БД, чтобы не было конфликта при подмене основной БД
  try {
    await rm(`${DB_PATH}-wal`, { force: true })
    await rm(`${DB_PATH}-shm`, { force: true })
  }
  catch { }

  let restored = 0

  for (const s3Key of s3Keys) {
    // Убираем префикс дампа (dumps/YYYY-MM-DD/), чтобы получить относительный путь (db/... или uploads/...)
    const relativeKey = s3Key.substring(dumpPrefixToUse.length)

    if (relativeKey.startsWith('db/insight-book.sqlite')) {
      // ── БД: всегда восстанавливаем на диск ────────────────────────
      await mkdir(path.dirname(DB_PATH), { recursive: true })
      const fileData = await storageService.getFile(s3Key)
      if (fileData) {
        await Bun.write(DB_PATH, fileData.buffer)
        restored++
        process.stdout.write(`\r✅ Progress: ${restored}/${s3Keys.length}`)
      }
      else {
        console.error(`\n❌ Failed to download DB: ${s3Key}`)
      }
    }
    else if (relativeKey.startsWith('uploads/')) {
      const uploadRelativePath = relativeKey.substring('uploads/'.length)
      const fileData = await storageService.getFile(s3Key)
      if (fileData) {
        await storageService.uploadFile(uploadRelativePath, fileData.buffer, fileData.contentType)
        restored++
        process.stdout.write(`\r✅ Progress: ${restored}/${s3Keys.length}`)
      }
      else {
        console.error(`\n❌ Failed to download: ${s3Key}`)
      }
    }
    else {
      console.warn(`\n⚠️  Skipping unknown file mapping: ${s3Key}`)
    }
  }

  console.log('\n🎉 Seed completed successfully! Please restart the server if it is currently running.')
}

main().catch((err) => {
  console.error('\n❌ Seed failed:', err)
  process.exit(1)
})
