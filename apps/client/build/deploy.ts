import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { join, relative } from 'node:path'
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

// Настройки Bunny.net Storage
const BUNNY_STORAGE_ZONE = (process.env.BUNNY_STORAGE_ZONE || process.env.S3_BUCKET || '').trim()
const BUNNY_STORAGE_PASSWORD = (process.env.BUNNY_STORAGE_PASSWORD || process.env.S3_SECRET_KEY || '').trim()
const BUNNY_STORAGE_REGION = (process.env.BUNNY_STORAGE_REGION || '').trim() // e.g. 'ny', 'sg', по умолчанию пустой (Германия)

// Bunny.net API для авто-сброса кэша (Purge)
const BUNNY_API_KEY = (process.env.BUNNY_API_KEY || '').trim()
const BUNNY_PULL_ZONE_ID = (process.env.BUNNY_PULL_ZONE_ID || '').trim()

// Лимит параллельных запросов на загрузку
const CONCURRENCY_LIMIT = 10

const missingVars: string[] = []
if (!BUNNY_STORAGE_ZONE)
  missingVars.push('BUNNY_STORAGE_ZONE (или S3_BUCKET)')
if (!BUNNY_STORAGE_PASSWORD)
  missingVars.push('BUNNY_STORAGE_PASSWORD (или S3_SECRET_KEY)')

if (missingVars.length > 0) {
  logger.error({ missingVars }, `❌ Не заполнены обязательные переменные Bunny Storage (${missingVars.join(', ')}). Проверьте секреты в GitHub Actions!`)
  process.exit(1)
}

const BUNNY_STORAGE_HOST = BUNNY_STORAGE_REGION
  ? `${BUNNY_STORAGE_REGION.toLowerCase()}.storage.bunnycdn.com`
  : 'storage.bunnycdn.com'

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

  const apiUrl = process.env.VITE_API_URL || process.env.API_URL
  const faroUrl = process.env.VITE_FARO_URL || process.env.FARO_URL

  const cdnUrl = process.env.VITE_CDN_URL || process.env.CDN_URL
  if (apiUrl)
    config.API_URL = apiUrl

  if (faroUrl)
    config.FARO_URL = faroUrl

  if (cdnUrl)
    config.CDN_URL = cdnUrl

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

// Получение списка всех имеющихся файлов в Bunny Storage для пропуска повторных ассетов
async function getExistingBunnyKeys(storageZone: string, accessKey: string): Promise<Set<string>> {
  const existingKeys = new Set<string>()

  async function scan(currentPath: string) {
    try {
      const url = `https://${BUNNY_STORAGE_HOST}/${storageZone}/${currentPath}`
      const response = await fetch(url, {
        headers: {
          AccessKey: accessKey,
          Accept: 'application/json',
        },
      })

      if (!response.ok) {
        if (response.status === 404)
          return
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const items = (await response.json()) as Array<{ ObjectName: string, IsDirectory: boolean }>
      for (const item of items) {
        const itemPath = `${currentPath}${item.ObjectName}`
        if (item.IsDirectory) {
          await scan(`${itemPath}/`)
        }
        else {
          existingKeys.add(itemPath)
        }
      }
    }
    catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      logger.warn({ path: currentPath, message }, '⚠️ Не удалось получить список файлов из Bunny Storage, файлы будут проверены на загрузку')
    }
  }

  await scan('')

  return existingKeys
}

async function deploy() {
  logger.info({ host: BUNNY_STORAGE_HOST, zone: BUNNY_STORAGE_ZONE }, '🚀 Начинаем деплой в Bunny Storage...')
  const distDir = join(import.meta.dirname, '../dist')

  // Генерируем свежий рантайм-конфиг
  generateAppConfig(distDir)

  const allFiles = getAllFiles(distDir)

  // Фильтруем сжатые файлы, так как Bunny CDN сжимает на лету
  const filesToUpload = allFiles.filter(filePath => !filePath.endsWith('.gz') && !filePath.endsWith('.br'))

  const { assets, entrypoints } = partitionFiles(filesToUpload, distDir)

  // Получаем список уже загруженных файлов из Bunny Storage
  const existingKeys = await getExistingBunnyKeys(BUNNY_STORAGE_ZONE, BUNNY_STORAGE_PASSWORD)

  // Исключаем ассеты, которые уже есть в хранилище (так как их имена с хешем неизменяемы)
  const assetsToUpload = assets.filter((filePath) => {
    const relativePath = relative(distDir, filePath).replace(/\\/g, '/')

    return !existingKeys.has(relativePath)
  })

  const skippedCount = assets.length - assetsToUpload.length
  if (skippedCount > 0) {
    logger.info({ count: skippedCount }, '⏩ Пропущены ассеты, уже присутствующие в Bunny Storage')
  }

  const uploadFile = async (filePath: string) => {
    const relativePath = relative(distDir, filePath).replace(/\\/g, '/')
    const fileContent = readFileSync(filePath)
    const mimeType = getMimeType(filePath)

    const isAsset
      = relativePath.startsWith('assets/')
        || /\.(?:woff2|woff|ttf|otf|eot)$/i.test(relativePath)

    logger.info({
      file: relativePath,
      mime: mimeType,
      type: isAsset ? 'asset' : 'entrypoint',
    }, '📤 Загрузка файла в Bunny Storage')

    const url = `https://${BUNNY_STORAGE_HOST}/${BUNNY_STORAGE_ZONE}/${relativePath}`
    const maxRetries = 5

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await fetch(url, {
          method: 'PUT',
          headers: {
            'AccessKey': BUNNY_STORAGE_PASSWORD,
            'Content-Type': mimeType,
          },
          body: fileContent,
        })

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }

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
        }, '⚠️ Ошибка при отправке файла в Bunny Storage, повторная попытка...')

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

  logger.info('✅ Все файлы успешно загружены в Bunny Storage!')

  await purgeBunnyCache()
}

deploy().catch((err) => {
  logger.error({ err }, '❌ Ошибка деплоя')
  process.exit(1)
})
