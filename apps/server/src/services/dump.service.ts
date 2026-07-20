import { Database } from 'bun:sqlite'
import { eq } from 'drizzle-orm'
import { DB_PATH } from '../config'
import { db } from '../db'
import * as schema from '../db/schema'
import { storageService } from './storage.service'

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
    log(`📦 Creating dump: ${dumpPrefix}`)

    // 2. Сбрасываем WAL в основной файл
    log('🗄️ Checkpointing SQLite database...')
    const sqliteDb = new Database(DB_PATH)
    sqliteDb.run('PRAGMA wal_checkpoint(PASSIVE)') // В режиме PASSIVE не блокирует читающих/пишущих клиентов
    sqliteDb.close()

    const dbFile = Bun.file(DB_PATH)
    if (await dbFile.exists()) {
      const buffer = await dbFile.arrayBuffer()
      await storageService.uploadFile(`${dumpPrefix}/db/insight-book.sqlite`, buffer)
    }

    log('📂 Copying media to dump...')
    for (const prefix of ['covers/', 'avatars/', 'books/']) {
      const keys = await storageService.listFilesInFolder(prefix)
      let uploaded = 0
      for (const key of keys) {
        const fileData = await storageService.getFile(key)
        if (fileData) {
          await storageService.uploadFile(`${dumpPrefix}/uploads/${key}`, fileData.buffer, fileData.contentType)
          uploaded++
          if (uploaded % 100 === 0)
            log(`✅ Copied ${uploaded} ${prefix} files`)
        }
      }
    }

    log(`🎉 Dump created successfully: ${dumpPrefix}`)

    // Очистка старых дампов, оставляем только 10
    const dumpFolders = await storageService.listDumpFolders('dumps')
    dumpFolders.sort() // Сортируем по возрастанию (самые старые первыми)
    while (dumpFolders.length > 10) {
      const oldest = dumpFolders.shift()
      if (oldest) {
        log(`🗑️ Deleting old dump: ${oldest}`)
        await storageService.deleteFolder(oldest)
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
