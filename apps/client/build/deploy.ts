import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { join, relative } from 'node:path'
import { ListObjectsV2Command, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
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
let rawEndpoint = (process.env.S3_ENDPOINT || '').trim()
const S3_REGION = (process.env.S3_REGION || '').trim()
const S3_BUCKET = (process.env.S3_BUCKET || '').trim()
const S3_ACCESS_KEY = (process.env.S3_ACCESS_KEY || '').trim()
const S3_SECRET_KEY = (process.env.S3_SECRET_KEY || '').trim()

// Bunny.net API для авто-сброса кэша (Purge)
const BUNNY_API_KEY = (process.env.BUNNY_API_KEY || '').trim()
const BUNNY_PULL_ZONE_ID = (process.env.BUNNY_PULL_ZONE_ID || '').trim()

// Лимит параллельных запросов на загрузку
const CONCURRENCY_LIMIT = 10

const missingVars: string[] = []
if (!rawEndpoint)
  missingVars.push('S3_ENDPOINT')
if (!S3_BUCKET)
  missingVars.push('S3_BUCKET')
if (!S3_ACCESS_KEY)
  missingVars.push('S3_ACCESS_KEY')
if (!S3_SECRET_KEY)
  missingVars.push('S3_SECRET_KEY')

if (missingVars.length > 0) {
  logger.error({ missingVars }, `❌ Не заполнены обязательные переменные S3 (${missingVars.join(', ')}). Проверьте секреты в GitHub Actions repository settings!`)
  process.exit(1)
}

if (!rawEndpoint.startsWith('http://') && !rawEndpoint.startsWith('https://')) {
  rawEndpoint = `https://${rawEndpoint}`
}

const S3_ENDPOINT = rawEndpoint

const s3 = new S3Client({
  endpoint: S3_ENDPOINT,
  region: S3_REGION,
  credentials: {
    accessKeyId: S3_ACCESS_KEY,
    secretAccessKey: S3_SECRET_KEY,
  },
  forcePathStyle: true,
  maxAttempts: 5,
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

// Функция-помощник для параллельного выполнения задач с ограничением concurrency через очередь воркеров
async function pool<T>(items: T[], concurrency: number, task: (item: T) => Promise<void>): Promise<void> {
  const queue = [...items]
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (queue.length > 0) {
      const item = queue.shift()
      if (item !== undefined) {
        await task(item)
      }
    }
  })
  await Promise.all(workers)
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

// Автоматическая генерация app-config.js из переменных окружения перед деплоем
function generateAppConfig(distDir: string) {
  const configsDir = join(distDir, 'configs')
  const configPath = join(configsDir, 'app-config.js')

  const apiUrl = process.env.VITE_API_URL || process.env.API_URL || ''
  const faroUrl = process.env.VITE_FARO_URL || process.env.FARO_URL || ''

  const config: Record<string, string> = {}
  if (apiUrl)
    config.API_URL = apiUrl
  if (faroUrl)
    config.FARO_URL = faroUrl

  if (!existsSync(configsDir)) {
    mkdirSync(configsDir, { recursive: true })
  }

  const content = `// Сгенерировано автоматически перед деплоем на S3/CDN\nwindow.__APP_CONFIG__ = ${JSON.stringify(config, null, 2)};\n`
  writeFileSync(configPath, content, 'utf-8')
  logger.info({ config }, '📝 Сгенерирован рантайм-конфиг configs/app-config.js')
}

// Автоматический сброс кэша Bunny CDN
async function purgeBunnyCache() {
  if (!BUNNY_API_KEY || !BUNNY_PULL_ZONE_ID)
    return

  logger.info('🧹 Очистка кэша входных точек в Bunny CDN...')
  try {
    const urlsToPurge = [
      'https://cdn.insight-book.ru/index.html',
      'https://cdn.insight-book.ru/sw.js',
      'https://cdn.insight-book.ru/manifest.webmanifest',
      'https://cdn.insight-book.ru/configs/app-config.js',
    ]

    await Promise.all(urlsToPurge.map(url =>
      fetch(`https://api.bunny.net/purge?url=${encodeURIComponent(url)}`, {
        method: 'POST',
        headers: { AccessKey: BUNNY_API_KEY },
      })))

    logger.info('✨ Кэш входных точек очищен!')
  }
  catch (err) {
    logger.error({ err }, '⚠️ Ошибка при очистке кэша')
    throw err
  }
}

// Получение списка всех имеющихся ключей в S3 бакете для пропуска повторных ассетов
async function getExistingS3Keys(bucket: string): Promise<Set<string>> {
  const existingKeys = new Set<string>()
  let continuationToken: string | undefined

  try {
    do {
      const response = await s3.send(new ListObjectsV2Command({
        Bucket: bucket,
        ContinuationToken: continuationToken,
      }))

      if (response.Contents) {
        for (const obj of response.Contents) {
          if (obj.Key) {
            existingKeys.add(obj.Key)
          }
        }
      }

      continuationToken = response.IsTruncated ? response.NextContinuationToken : undefined
    } while (continuationToken)
  }
  catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    logger.warn({ message }, '⚠️ Не удалось получить список существующих файлов в S3, все файлы будут проверены на загрузку')
  }

  return existingKeys
}

async function deploy() {
  logger.info({ endpoint: S3_ENDPOINT, bucket: S3_BUCKET, region: S3_REGION }, '🚀 Начинаем деплой в S3...')
  const distDir = join(import.meta.dirname, '../dist')

  // Генерируем свежий рантайм-конфиг
  generateAppConfig(distDir)

  const allFiles = getAllFiles(distDir)

  // Фильтруем сжатые файлы, так как Bunny CDN сжимает на лету
  const filesToUpload = allFiles.filter(filePath => !filePath.endsWith('.gz') && !filePath.endsWith('.br'))

  const { assets, entrypoints } = partitionFiles(filesToUpload, distDir)

  // Получаем список уже загруженных файлов из S3
  const existingKeys = await getExistingS3Keys(S3_BUCKET)

  // Исключаем ассеты, которые уже есть на S3 (так как их имена с хешем неизменяемы)
  const assetsToUpload = assets.filter((filePath) => {
    const relativePath = relative(distDir, filePath).replace(/\\/g, '/')

    return !existingKeys.has(relativePath)
  })

  const skippedCount = assets.length - assetsToUpload.length
  if (skippedCount > 0) {
    logger.info({ count: skippedCount }, '⏩ Пропущены ассеты, уже присутствующие в S3')
  }

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

    const maxRetries = 5
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await s3.send(new PutObjectCommand({
          Bucket: S3_BUCKET,
          Key: relativePath,
          Body: fileContent,
          ContentType: mimeType,
          CacheControl: cacheControl,
        }))

        return
      }
      catch (err: unknown) {
        if (attempt === maxRetries) {
          throw err
        }

        const delay = attempt * 500
        const message = err instanceof Error ? err.message : String(err)
        logger.warn({
          file: relativePath,
          attempt,
          delay,
          message,
        }, '⚠️ Ошибка при отправке файла в S3, повторная попытка...')

        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
  }

  // 1. Сначала загружаем новые ассеты (безопасно для пользователей)
  if (assetsToUpload.length > 0) {
    logger.info({ count: assetsToUpload.length }, '📦 Загрузка новых ассетов')
    await pool(assetsToUpload, CONCURRENCY_LIMIT, uploadFile)
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
