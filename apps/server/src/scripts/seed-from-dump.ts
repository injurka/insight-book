import { mkdir, rm } from 'node:fs/promises'
import path from 'node:path'
import { DB_PATH, UPLOADS_PATH } from '../config'
import { s3Service } from '../services/s3.service'

const args = process.argv.slice(2)
const specificDump = args[0] // Например: dumps/2026-06-02T12-00-00/

async function main() {
  console.log('⚠️ WARNING: Restoring from a dump will overwrite current database and uploads.')
  console.log('🔄 Checking S3 connection...')
  await s3Service.checkConnection()
  console.log('✅ S3 Connection OK')

  let dumpPrefixToUse = specificDump

  if (!dumpPrefixToUse) {
    console.log('🔍 No specific dump provided. Finding the latest one...')
    const dumps = await s3Service.listDumpFolders('dumps')
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

  const s3Keys = await s3Service.listFilesInFolder(dumpPrefixToUse)
  if (s3Keys.length === 0) {
    console.error('❌ No files found in this dump.')
    process.exit(1)
  }

  console.log(`📥 Downloading ${s3Keys.length} files...`)

  // Удаляем старые WAL файлы БД, чтобы не было конфликта при подмене основной БД
  try {
    await rm(`${DB_PATH}-wal`, { force: true })
    await rm(`${DB_PATH}-shm`, { force: true })
  }
  catch { }

  let downloaded = 0

  for (const s3Key of s3Keys) {
    // Убираем префикс дампа (dumps/YYYY-MM-DD/), чтобы получить относительный путь (db/... или uploads/...)
    const relativeKey = s3Key.substring(dumpPrefixToUse.length)
    let localDestPath = ''

    if (relativeKey.startsWith('db/insight-book.sqlite')) {
      localDestPath = DB_PATH
    }
    else if (relativeKey.startsWith('uploads/')) {
      const uploadRelativePath = relativeKey.substring('uploads/'.length)
      // Преобразуем S3-путь в системный путь
      localDestPath = path.join(UPLOADS_PATH, ...uploadRelativePath.split('/'))
    }
    else {
      console.warn(`\n⚠️ Skipping unknown file mapping: ${s3Key}`)
      continue
    }

    // Создаем директории, если их нет
    await mkdir(path.dirname(localDestPath), { recursive: true })

    // Скачиваем и сохраняем
    const fileData = await s3Service.getFile(s3Key)
    if (fileData) {
      await Bun.write(localDestPath, fileData.buffer)
      downloaded++
      process.stdout.write(`\r✅ Progress: ${downloaded}/${s3Keys.length}`)
    }
    else {
      console.error(`\n❌ Failed to download: ${s3Key}`)
    }
  }

  console.log('\n🎉 Seed completed successfully! Please restart the server if it is currently running.')
}

main().catch((err) => {
  console.error('\n❌ Seed failed:', err)
  process.exit(1)
})
