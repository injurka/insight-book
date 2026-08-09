/* eslint-disable antfu/no-top-level-await */

import fs from 'node:fs/promises'
import path from 'node:path'
import { isMainThread } from 'node:worker_threads'
import { instrumentDrizzleClient } from '@kubiks/otel-drizzle'
import { createClient } from '@libsql/client'
import { eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/libsql'
import { catalogClient, initCatalogDb } from '~/db/catalog'
import {
  ADMIN_PASSWORD,
  ADMIN_USERNAME,
  BOOKS_PATH,
  CATALOG_DATABASE_URL,
  COVERS_PATH,
  DATABASE_AUTH_TOKEN,
  DATABASE_URL,
  DB_PATH,
  UPLOAD_STORAGE,
  UPLOADS_PATH,
} from '../config'
import { ROLES } from '../constants/roles'
import { logger } from '../utils/logger'
import * as schema from './schema'

const dbDir = path.dirname(DB_PATH)

// Создаем директории для БД и временной обработки файлов загрузки
await fs.mkdir(dbDir, { recursive: true })
await fs.mkdir(BOOKS_PATH, { recursive: true })

// Внутренние папки постоянного хранения файлов создаем только для локального хранилища
if (UPLOAD_STORAGE === 'local') {
  await fs.mkdir(COVERS_PATH, { recursive: true })
  await fs.mkdir(path.join(UPLOADS_PATH, 'avatars'), { recursive: true })
}

// ============================================================================
// 1. ИНИЦИАЛИЗАЦИЯ ПОДКЛЮЧЕНИЯ
// ============================================================================
export const client = createClient({ url: DATABASE_URL, authToken: DATABASE_AUTH_TOKEN })
await client.execute('PRAGMA foreign_keys = ON')

export const db = drizzle(client, { schema, logger: false })
instrumentDrizzleClient(db)

// ============================================================================
// 2. АВТОМАТИЧЕСКАЯ СИНХРОНИЗАЦИЯ БАЗЫ ДАННЫХ И ДЕФОЛТНЫЙ ЮЗЕР
// ============================================================================
void (async () => {
  // Запускаем миграции только если скрипт запущен напрямую как API сервер (через index.ts)
  const isMainServer = Bun.main && path.basename(Bun.main) === 'index.ts'

  if (isMainThread && isMainServer) {
    logger.info('🔄 Checking and applying database migrations...')

    try {
      logger.info(`🗄️  Catalog Database initialized at ${CATALOG_DATABASE_URL}`)
      await initCatalogDb()

      const deckRes = await catalogClient.execute('SELECT count(*) as count FROM official_decks')
      const wordRes = await catalogClient.execute('SELECT count(*) as count FROM official_deck_words')

      const decksCount = Number(deckRes.rows[0]?.count || 0)
      const wordsCount = Number(wordRes.rows[0]?.count || 0)

      if (decksCount > 0) {
        logger.info(`✅ Catalog database verified: found ${decksCount} decks and ${wordsCount} words.`)
      }
      else {
        logger.info(`✅ Catalog database verified (Empty).`)
        logger.info(`💡 Tip: Run 'bun run deck:seed' to populate the catalog with standard decks.`)
      }
    }
    catch (e) {
      logger.error(e, '❌ Failed to setup catalog database tables:')
    }

    try {
      const adminExists = await db.query.users.findFirst({ where: eq(schema.users.id, 1) })

      if (!adminExists) {
        logger.info('👤 Default admin user not found. Creating one...')
        const passwordHash = await Bun.password.hash(ADMIN_PASSWORD)

        await db.insert(schema.users).values({
          id: 1,
          username: ADMIN_USERNAME,
          passwordHash,
          role: ROLES.ADMIN,
          tokenLimit: null,
          bookLimit: null,
        })
        logger.info(`👤 Default Admin user created (Username: ${ADMIN_USERNAME}).`)
      }
    }
    catch (e) {
      logger.error(e, '⚠️ Could not check/create admin user:')
    }

    logger.info(`🗄️ Main Database initialized at ${DATABASE_URL}`)
  }
})().catch((err) => {
  logger.error(err, '❌ Critical error during database initialization:')
  process.exit(1)
})

// ============================================================================
// 3. БЕЗОПАСНОЕ ЗАВЕРШЕНИЕ РАБОТЫ
// ============================================================================
function shutdown() {
  if (isMainThread)
    logger.info('\n🛑 Shutting down server... Closing databases...')
  try {
    client.close()
    catalogClient.close()
  }
  catch { }

  process.exit(0)
}

if (isMainThread) {
  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}
