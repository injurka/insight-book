import path from 'node:path'

export const PORT = Number.parseInt(process.env.PORT || '4444')

// --- Authentication ---
export const AUTH_MODE = process.env.AUTH_MODE || 'single' // 'single' | 'multi'

if (AUTH_MODE !== 'single' && !process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET must be provided in production when AUTH_MODE !== single')
}

export const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-local-key'
export const YANDEX_CLIENT_ID = process.env.YANDEX_CLIENT_ID || ''
export const YANDEX_CLIENT_SECRET = process.env.YANDEX_CLIENT_SECRET || ''
export const UNISENDER_API_KEY = process.env.UNISENDER_API_KEY || ''
export const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173'

// --- Paths ---
export const DB_PATH = process.env.DB_PATH || path.resolve(process.cwd(), 'db', 'insight-book.sqlite')
export const CATALOG_DB_PATH = process.env.CATALOG_DB_PATH || path.resolve(process.cwd(), 'db', 'catalog.sqlite')
export const DICTS_PATH = process.env.DICTS_PATH || path.resolve(process.cwd(), 'db', 'dicts')
export const UPLOADS_PATH = process.env.UPLOADS_PATH || path.resolve(process.cwd(), 'uploads')
export const BOOKS_PATH = path.join(UPLOADS_PATH, 'books')
export const COVERS_PATH = path.join(UPLOADS_PATH, 'covers')
export const UPLOAD_STORAGE = process.env.UPLOAD_STORAGE || 'local' // 'local' | 's3'

// -- Default ADMIN user ---
export const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin'
export const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin'

// --- Push Notifications (Web Push) ---
export const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || ''
export const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || ''
export const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@insight-book.com'

// --- Limits & Configs ---
export const PAGE_SIZE_CHARS = 1500
export const MAX_DAILY_TOKENS = Number.parseInt(process.env.MAX_DAILY_TOKENS || '100_000')

export const MIME_OVERRIDES: Record<string, string> = {
  '.md': 'text/markdown; charset=utf-8',
}

export const CORS_HEADERS = {
  'Access-Control-Allow-Origin': FRONTEND_URL,
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, HEAD, OPTIONS, DELETE',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, Accept, X-Custom-Llm-Url, X-Custom-Llm-Key, X-Custom-Llm-Model',
}

// Origins allowed in addition to FRONTEND_URL (Tauri webviews, extra env origins).
const EXTRA_CORS_ORIGINS = (process.env.CORS_EXTRA_ORIGINS || '')
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

// CORS headers with Allow-Origin resolved against the request origin.
export function corsHeadersFor(origin: string | null): Record<string, string> {
  const allowOrigin = origin && ALLOWED_ORIGINS.has(origin) ? origin : FRONTEND_URL

  return { ...CORS_HEADERS, 'Access-Control-Allow-Origin': allowOrigin, 'Vary': 'Origin' }
}
