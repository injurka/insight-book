import path from 'node:path'
import { z } from 'zod'

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(4444),

  // --- Authentication ---
  AUTH_MODE: z.enum(['single', 'multi']).default('single'),
  JWT_SECRET: z.string().min(1).default('super-secret-local-key'),
  YANDEX_CLIENT_ID: z.string().default(''),
  YANDEX_CLIENT_SECRET: z.string().default(''),
  UNISENDER_API_KEY: z.string().default(''),
  FRONTEND_URL: z.string().url().default('http://localhost:5173'),
  ADMIN_FRONTEND_URL: z.string().url().optional(),

  // --- Storage & DB Paths ---
  DB_PATH: z.string().optional(),
  CATALOG_DB_PATH: z.string().optional(),
  UPLOADS_PATH: z.string().optional(),
  UPLOAD_STORAGE: z.enum(['local', 's3']).default('local'),

  // --- Database Connection URLs ---
  DATABASE_URL: z.string().optional(),
  DATABASE_AUTH_TOKEN: z.string().optional(),
  BUNNY_DATABASE_URL: z.string().optional(),
  BUNNY_DATABASE_AUTH_TOKEN: z.string().optional(),
  CATALOG_DATABASE_URL: z.string().optional(),
  CATALOG_DATABASE_AUTH_TOKEN: z.string().optional(),

  // --- Admin ---
  ADMIN_USERNAME: z.string().default('admin'),
  ADMIN_PASSWORD: z.string().default('admin'),

  // --- Web Push ---
  VAPID_PUBLIC_KEY: z.string().default(''),
  VAPID_PRIVATE_KEY: z.string().default(''),
  VAPID_SUBJECT: z.string().default('mailto:admin@insight-book.com'),

  // --- Limits & Observability ---
  MAX_DAILY_TOKENS: z.coerce.number().int().positive().default(100_000),
  // OTLP-коллектор: SigNoz ingester (алиас в prod-net). Корневой URL,
  // сигнальный путь (/v1/traces|metrics|logs) экспортеры дописывают сами.
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().url().default('http://signoz-ingester:4318'),
  OTEL_SERVICE_NAME: z.string().min(1).default('insight-book-server'),

  // --- Dump Storage (separate from media uploads) ---
  DUMP_STORAGE: z.enum(['local', 's3']).default('local'),
  DUMP_S3_BUCKET: z.string().optional(),
  DUMP_S3_REGION: z.string().default('default'),
  DUMP_S3_ENDPOINT: z.string().optional(),
  DUMP_S3_ACCESS_KEY: z.string().optional(),
  DUMP_S3_SECRET_KEY: z.string().optional(),

  // --- Extras ---
  CORS_EXTRA_ORIGINS: z.string().default(''),
  DUMP_MEDIA: z.preprocess(val => val === 'true', z.boolean()).default(false),
})

const parsedEnv = envSchema.safeParse(process.env)

if (!parsedEnv.success) {
  console.error('❌ Invalid environment variables:', parsedEnv.error.format())
  throw new Error('Application environment configuration error')
}

const env = parsedEnv.data

if (env.NODE_ENV === 'production' && env.AUTH_MODE === 'multi' && env.JWT_SECRET === 'super-secret-local-key') {
  throw new Error('JWT_SECRET must be provided in production when AUTH_MODE !== single')
}

// --- Dynamic Derived Paths ---
export const DB_PATH = env.DB_PATH || path.resolve(process.cwd(), 'db', 'insight-book.sqlite')
export const CATALOG_DB_PATH = env.CATALOG_DB_PATH || path.resolve(process.cwd(), 'db', 'catalog.sqlite')
export const UPLOADS_PATH = env.UPLOADS_PATH || path.resolve(process.cwd(), 'uploads')
export const BOOKS_PATH = path.join(UPLOADS_PATH, 'books')
export const COVERS_PATH = path.join(UPLOADS_PATH, 'covers')

export const DATABASE_URL = env.DATABASE_URL || `file:${DB_PATH}`
export const CATALOG_DATABASE_URL = env.CATALOG_DATABASE_URL || env.BUNNY_DATABASE_URL || `file:${CATALOG_DB_PATH}`
export const CATALOG_DATABASE_AUTH_TOKEN = env.CATALOG_DATABASE_AUTH_TOKEN || env.BUNNY_DATABASE_AUTH_TOKEN

// --- Export validated env constants ---
export const {
  NODE_ENV,
  PORT,
  AUTH_MODE,
  JWT_SECRET,
  YANDEX_CLIENT_ID,
  YANDEX_CLIENT_SECRET,
  UNISENDER_API_KEY,
  FRONTEND_URL,
  ADMIN_FRONTEND_URL,
  CORS_EXTRA_ORIGINS,
  UPLOAD_STORAGE,
  DATABASE_AUTH_TOKEN,
  ADMIN_USERNAME,
  ADMIN_PASSWORD,
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY,
  VAPID_SUBJECT,
  MAX_DAILY_TOKENS,
  OTEL_EXPORTER_OTLP_ENDPOINT,
  OTEL_SERVICE_NAME,
  DUMP_MEDIA,
  DUMP_STORAGE,
} = env

// Пробрасываем OTLP-конфигурацию в переменные окружения процесса:
// их читают и OTel SDK, и pino-opentelemetry-transport (воркер-процесс pino,
// которому экспортированные константы недоступны).
process.env.OTEL_EXPORTER_OTLP_ENDPOINT ??= env.OTEL_EXPORTER_OTLP_ENDPOINT
process.env.OTEL_SERVICE_NAME ??= env.OTEL_SERVICE_NAME

// --- Limits & Configs ---
export const PAGE_SIZE_CHARS = 1500

export const MIME_OVERRIDES: Record<string, string> = {
  '.md': 'text/markdown; charset=utf-8',
}

// --- CORS Configuration ---
const EXTRA_CORS_ORIGINS = env.CORS_EXTRA_ORIGINS
  .split(/[\s,]+/)
  .map(o => o.trim())
  .filter(Boolean)

export const ALLOWED_ORIGINS = new Set([
  FRONTEND_URL,
  ...(env.ADMIN_FRONTEND_URL ? [env.ADMIN_FRONTEND_URL] : []),
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:3334',
  'http://localhost:3335',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
  'http://127.0.0.1:3334',
  'http://127.0.0.1:3335',
  'http://tauri.localhost', // Tauri Android
  'https://tauri.localhost', // Tauri iOS/macOS
  'tauri://localhost', // Tauri Windows/Linux
  ...EXTRA_CORS_ORIGINS,
])

export function isAllowedOrigin(origin: string | null): boolean {
  if (!origin)
    return false
  if (ALLOWED_ORIGINS.has('*') || ALLOWED_ORIGINS.has(origin))
    return true

  for (const allowed of ALLOWED_ORIGINS) {
    if (allowed.includes('*')) {
      const regexPattern = allowed
        .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
        .replace(/\\\*/g, '.*')
      const regex = new RegExp(`^${regexPattern}$`, 'i')
      if (regex.test(origin))
        return true
    }
  }

  try {
    const originUrl = new URL(origin)
    const originHost = originUrl.hostname

    // Project domains (production, preview & staging)
    if (
      originHost.endsWith('.limited-dissolve.ru')
      || originHost.endsWith('.insight-book.ru')
      || originHost === 'limited-dissolve.ru'
      || originHost === 'insight-book.ru'
      || originHost === 'localhost'
      || originHost === '127.0.0.1'
    ) {
      return true
    }

    const knownUrls = [FRONTEND_URL, env.ADMIN_FRONTEND_URL].filter(Boolean) as string[]

    for (const knownStr of knownUrls) {
      const knownUrl = new URL(knownStr)
      const knownHost = knownUrl.hostname

      if (originHost === knownHost || originHost.endsWith(`.${knownHost}`)) {
        return true
      }

      const originParts = originHost.split('.')
      const knownParts = knownHost.split('.')
      if (originParts.length >= 2 && knownParts.length >= 2) {
        const originRoot = originParts.slice(-2).join('.')
        const knownRoot = knownParts.slice(-2).join('.')
        if (originRoot === knownRoot && originRoot !== 'localhost') {
          return true
        }
      }
    }
  }
  catch {
    // Ignore invalid URL format
  }

  return false
}

export const CORS_HEADERS = {
  'Access-Control-Allow-Origin': FRONTEND_URL,
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, HEAD, OPTIONS, DELETE',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, Accept, X-Custom-Llm-Url, X-Custom-Llm-Key, X-Custom-Llm-Model, X-Analysis-Llm-Url, X-Analysis-Llm-Key, X-Analysis-Llm-Model, traceparent, tracestate, baggage, X-Requested-With, X-App-Language',
  'Access-Control-Expose-Headers': 'Server-Timing, Content-Disposition, Content-Length',
  'Access-Control-Max-Age': '86400',
}

// CORS headers with Allow-Origin resolved against the request origin.
export function corsHeadersFor(origin: string | null, requestHeaders?: string | null): Record<string, string> {
  const allowOrigin = origin && isAllowedOrigin(origin) ? origin : FRONTEND_URL

  const headers: Record<string, string> = {
    ...CORS_HEADERS,
    'Access-Control-Allow-Origin': allowOrigin,
    'Vary': 'Origin',
  }

  if (requestHeaders) {
    headers['Access-Control-Allow-Headers'] = requestHeaders
  }

  return headers
}
