import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import pino from 'pino'

const logger = pino({
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'HH:MM:ss.l',
      ignore: 'pid,hostname',
    },
  },
})

// Настройки вашего S3
const S3_ENDPOINT = process.env.S3_ENDPOINT!
const S3_REGION = process.env.S3_REGION!
const S3_BUCKET = process.env.S3_BUCKET!
const S3_ACCESS_KEY = process.env.S3_ACCESS_KEY!
const S3_SECRET_KEY = process.env.S3_SECRET_KEY!

// Bunny.net API для авто-сброса кэша (Purge)
const BUNNY_API_KEY = process.env.BUNNY_API_KEY!
const BUNNY_PULL_ZONE_ID = process.env.BUNNY_PULL_ZONE_ID!

// Лимит параллельных запросов на загрузку
const CONCURRENCY_LIMIT = 10

const s3 = new S3Client({
  endpoint: S3_ENDPOINT,
  region: S3_REGION,
  credentials: {
    accessKeyId: S3_ACCESS_KEY,
    secretAccessKey: S3_SECRET_KEY,
  },
  forcePathStyle: true,
})

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/sfnt',
  '.otf': 'font/sfnt',
  '.eot': 'application/vnd.ms-fontobject',
  '.wasm': 'application/wasm',
  '.epub': 'application/epub+zip',
  '.pdf': 'application/pdf',
  '.mp4': 'video/mp4',
  '.mp3': 'audio/mpeg',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
}

function getMimeType(filePath: string): string {
  const dotIndex = filePath.lastIndexOf('.')
  if (dotIndex === -1)
    return 'application/octet-stream'

  const ext = filePath.slice(dotIndex).toLowerCase()

  return MIME_TYPES[ext] || 'application/octet-stream'
}

function getAllFiles(dir: string): string[] {
  const files: string[] = []
  for (const file of readdirSync(dir)) {
    const fullPath = join(dir, file)
    if (statSync(fullPath).isDirectory()) {
      files.push(...getAllFiles(fullPath))
    }
    else {
      files.push(fullPath)
    }
  }

  return files
}

// Функция-помощник для параллельного выполнения задач с ограничением concurrency
async function pool<T>(items: T[], concurrency: number, task: (item: T) => Promise<void>): Promise<void> {
  const executing = new Set<Promise<void>>()
  for (const item of items) {
    const p = Promise.resolve().then(() => task(item))
    executing.add(p)
    const clean = () => executing.delete(p)
    p.then(clean, clean)
    if (executing.size >= concurrency) {
      await Promise.race(executing)
    }
  }

  await Promise.all(executing)
}

// Разделяет файлы на ассеты (кэшируемые навсегда) и входные точки (некэшируемые)
function partitionFiles(files: string[], distDir: string) {
  const assets: string[] = []
  const entrypoints: string[] = []

  for (const filePath of files) {
    const relativePath = relative(distDir, filePath).replace(/\\/g, '/')

    // В кэшируемые навсегда относим папку assets/ и все шрифты
    const isAsset
      = relativePath.startsWith('assets/')
        || /\.(?:woff2|woff|ttf|otf|eot)$/i.test(relativePath)

    if (isAsset) {
      assets.push(filePath)
    }
    else {
      entrypoints.push(filePath)
    }
  }

  return { assets, entrypoints }
}

// Автоматический сброс кэша Bunny CDN
async function purgeBunnyCache() {
  if (!BUNNY_API_KEY || !BUNNY_PULL_ZONE_ID)
    return

  logger.info('🧹 Очистка кэша в Bunny CDN...')
  try {
    const response = await fetch(`https://api.bunny.net/pullzone/${BUNNY_PULL_ZONE_ID}/purgeCache`, {
      method: 'POST',
      headers: { AccessKey: BUNNY_API_KEY },
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`HTTP ${response.status}: ${errorText}`)
    }

    logger.info('✨ Кэш CDN успешно очищен!')
  }
  catch (err) {
    logger.error({ err }, '⚠️ Ошибка при очистке кэша CDN Bunny')
    // Очистка кэша критична для доставки изменений, поэтому выбрасываем ошибку:
    throw err
  }
}

async function deploy() {
  logger.info('🚀 Начинаем деплой в S3...')
  const distDir = join(import.meta.dirname, '../dist')
  const allFiles = getAllFiles(distDir)

  // Фильтруем сжатые файлы, так как Bunny CDN сжимает на лету
  const filesToUpload = allFiles.filter(filePath => !filePath.endsWith('.gz') && !filePath.endsWith('.br'))

  const { assets, entrypoints } = partitionFiles(filesToUpload, distDir)

  const uploadFile = async (filePath: string) => {
    const relativePath = relative(distDir, filePath).replace(/\\/g, '/')
    const fileContent = readFileSync(filePath)
    const mimeType = getMimeType(filePath)

    const isAsset
      = relativePath.startsWith('assets/')
        || /\.(?:woff2|woff|ttf|otf|eot)$/i.test(relativePath)

    const cacheControl = isAsset
      ? 'public, max-age=31536000, immutable'
      : 'no-cache, no-store, must-revalidate'

    logger.info({
      file: relativePath,
      mime: mimeType,
      type: isAsset ? 'asset' : 'entrypoint',
    }, '📤 Загрузка файла')

    await s3.send(new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: relativePath,
      Body: fileContent,
      ContentType: mimeType,
      CacheControl: cacheControl,
    }))
  }

  // 1. Сначала загружаем ассеты (безопасно для пользователей)
  if (assets.length > 0) {
    logger.info({ count: assets.length }, '📦 Загрузка ассетов')
    await pool(assets, CONCURRENCY_LIMIT, uploadFile)
  }

  // 2. Затем загружаем критически важные входные файлы (index.html, sw.js и т.д.)
  if (entrypoints.length > 0) {
    logger.info({ count: entrypoints.length }, '🔑 Загрузка входных точек')
    await pool(entrypoints, CONCURRENCY_LIMIT, uploadFile)
  }

  logger.info('✅ Все файлы успешно загружены в S3!')

  await purgeBunnyCache()
}

deploy().catch((err) => {
  logger.error({ err }, '❌ Ошибка деплоя')
  process.exit(1)
})
