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
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().url().default('http://alloy:4318/v1/traces'),

  // --- Extras ---
  CORS_EXTRA_ORIGINS: z.string().default(''),
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
  PORT,
  AUTH_MODE,
  JWT_SECRET,
  YANDEX_CLIENT_ID,
  YANDEX_CLIENT_SECRET,
  UNISENDER_API_KEY,
  FRONTEND_URL,
  UPLOAD_STORAGE,
  DATABASE_AUTH_TOKEN,
  ADMIN_USERNAME,
  ADMIN_PASSWORD,
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY,
  VAPID_SUBJECT,
  MAX_DAILY_TOKENS,
  OTEL_EXPORTER_OTLP_ENDPOINT,
} = env

// --- Limits & Configs ---
export const PAGE_SIZE_CHARS = 1500

export const MIME_OVERRIDES: Record<string, string> = {
  '.md': 'text/markdown; charset=utf-8',
}

// --- CORS Configuration ---
const EXTRA_CORS_ORIGINS = env.CORS_EXTRA_ORIGINS
  .split(',')
  .map(o => o.trim())
  .filter(Boolean)

export const ALLOWED_ORIGINS = new Set([
  FRONTEND_URL,
  'http://tauri.localhost', // Tauri Android
  'https://tauri.localhost', // Tauri iOS/macOS
  'tauri://localhost', // Tauri Windows/Linux
  ...EXTRA_CORS_ORIGINS,
])

export const CORS_HEADERS = {
  'Access-Control-Allow-Origin': FRONTEND_URL,
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, HEAD, OPTIONS, DELETE',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, Accept, X-Custom-Llm-Url, X-Custom-Llm-Key, X-Custom-Llm-Model',
}

// CORS headers with Allow-Origin resolved against the request origin.
export function corsHeadersFor(origin: string | null): Record<string, string> {
  const allowOrigin = origin && ALLOWED_ORIGINS.has(origin) ? origin : FRONTEND_URL

  return { ...CORS_HEADERS, 'Access-Control-Allow-Origin': allowOrigin, 'Vary': 'Origin' }
}
