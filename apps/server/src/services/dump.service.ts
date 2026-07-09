import { readdir } from 'node:fs/promises'
import path from 'node:path'
import { Database } from 'bun:sqlite'
import { eq } from 'drizzle-orm'
import { DB_PATH, UPLOAD_STORAGE, UPLOADS_PATH } from '../config'
import { db } from '../db'
import * as schema from '../db/schema'
import { s3Service } from './s3.service'

async function getFilesRecursively(dir: string): Promise<string[]> {
  try {
    const dirents = await readdir(dir, { withFileTypes: true })
    const files = await Promise.all(
      dirents.map(async (dirent) => {
        const res = path.resolve(dir, dirent.name)
        return dirent.isDirectory() ? getFilesRecursively(res) : [res]
      }),
    )
    return Array.prototype.concat(...files)
  }
  catch {
    return []
  }
}

export async function executeDump(logCallback?: (msg: string) => void): Promise<void> {
  // eslint-disable-next-line no-console
  const log = logCallback || ((msg: string) => console.log(`[Dump Service] ${msg}`))

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const dumpPrefix = `dumps/${timestamp}`

  // 1. Создаем запись в базе о начале дампа
  const [logEntry] = await db.insert(schema.dumpLogs).values({
    prefix: dumpPrefix,
    status: 'in-progress',
  }).returning()

  try {
    log('🔄 Checking S3 connection...')
    await s3Service.checkConnection()
    log('✅ S3 Connection OK')
    log(`📦 Creating dump: ${dumpPrefix}`)

    // 2. Сбрасываем WAL в основной файл
    log('🗄️ Checkpointing SQLite database...')
    const sqliteDb = new Database(DB_PATH)
    sqliteDb.run('PRAGMA wal_checkpoint(PASSIVE)') // В режиме PASSIVE не блокирует читающих/пишущих клиентов
    sqliteDb.close()

    const filesToUpload: { localPath: string, s3Key: string }[] = []

    // База данных
    filesToUpload.push({
      localPath: DB_PATH,
      s3Key: `${dumpPrefix}/db/insight-book.sqlite`,
    })

    // Файлы
    if (UPLOAD_STORAGE === 's3') {
      // В S3-режиме медиафайлы уже в S3: копируем uploads/* → dumpPrefix/uploads/*
      log('📂 S3 mode: copying media from s3 uploads/ to dump...')
      const s3MediaKeys = await s3Service.listFilesInFolder('uploads/')
      for (const s3Key of s3MediaKeys) {
        // s3Key: uploads/books/folder/page.jpg → dumpKey: dumps/ts/uploads/books/folder/page.jpg
        const fileData = await s3Service.getFile(s3Key)
        if (fileData) {
          await s3Service.uploadFile(`${dumpPrefix}/${s3Key}`, fileData.buffer, fileData.contentType)
        }
      }
      // Также копируем covers/ и avatars/ которые хранятся без префикса uploads/
      for (const prefix of ['covers/', 'avatars/', 'books/']) {
        const keys = await s3Service.listFilesInFolder(prefix)
        for (const s3Key of keys) {
          const fileData = await s3Service.getFile(s3Key)
          if (fileData) {
            await s3Service.uploadFile(`${dumpPrefix}/uploads/${s3Key}`, fileData.buffer, fileData.contentType)
          }
        }
      }
    }
    else {
      // local-режим: читаем из локальной файловой системы
      const uploadFiles = await getFilesRecursively(UPLOADS_PATH)
      for (const filePath of uploadFiles) {
        const relativePath = path.relative(UPLOADS_PATH, filePath)
        const s3Path = relativePath.split(path.sep).join('/')
        filesToUpload.push({
          localPath: filePath,
          s3Key: `${dumpPrefix}/uploads/${s3Path}`,
        })
      }
    }

    if (UPLOAD_STORAGE !== 's3' && filesToUpload.length > 0) {
      log(`🚀 Uploading ${filesToUpload.length} files to S3...`)
      let uploaded = 0

      for (const { localPath, s3Key } of filesToUpload) {
        const file = Bun.file(localPath)
        if (await file.exists()) {
          const buffer = await file.arrayBuffer()
          await s3Service.uploadFile(s3Key, buffer)
          uploaded++

          if (uploaded % 10 === 0 || uploaded === filesToUpload.length) {
            log(`✅ Progress: ${uploaded}/${filesToUpload.length}`)
          }
        }
      }
    }

    log(`🎉 Dump created successfully: ${dumpPrefix}`)

    // Очистка старых дампов, оставляем только 10
    const dumpFolders = await s3Service.listDumpFolders('dumps')
    dumpFolders.sort() // Сортируем по возрастанию (самые старые первыми)
    while (dumpFolders.length > 10) {
      const oldest = dumpFolders.shift()
      if (oldest) {
        log(`🗑️ Deleting old dump: ${oldest}`)
        await s3Service.deleteFolder(oldest)
      }
    }

    // 3. Успешное завершение
    await db.update(schema.dumpLogs)
      .set({ status: 'success', completedAt: new Date().toISOString() })
      .where(eq(schema.dumpLogs.id, logEntry.id))
  }
  catch (error: unknown) {
    const err = error as Error
    log(`❌ Dump failed: ${err.message}`)

    // 4. Логируем ошибку
    await db.update(schema.dumpLogs)
      .set({ status: 'failed', error: err.message || 'Unknown error', completedAt: new Date().toISOString() })
      .where(eq(schema.dumpLogs.id, logEntry.id))

    throw error
  }
}
