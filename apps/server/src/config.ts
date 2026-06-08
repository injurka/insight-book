import path from 'node:path'

export const PORT = Number.parseInt(process.env.PORT || '4444')

// --- Authentication ---
export const AUTH_MODE = process.env.AUTH_MODE || 'single' // 'single' | 'multi'
export const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-local-key'

// --- Paths ---
export const DB_PATH = process.env.DB_PATH || path.resolve(process.cwd(), 'db', 'insight-book.sqlite')
export const DICTS_PATH = process.env.DICTS_PATH || path.resolve(process.cwd(), 'db', 'dicts')
export const UPLOADS_PATH = process.env.UPLOADS_PATH || path.resolve(process.cwd(), 'uploads')
export const BOOKS_PATH = path.join(UPLOADS_PATH, 'books')
export const COVERS_PATH = path.join(UPLOADS_PATH, 'covers')

// --- AI & External APIs ---
export const LLM_API_KEY = process.env.LLM_API_KEY || ''
export const LLM_API_URL = process.env.LLM_API_URL || 'https://aihubmix.com/v1'
export const LLM_MODEL = process.env.LLM_MODEL || 'gemini-3.1-flash-lite'
export const LLM_FALLBACK_MODEL = process.env.LLM_FALLBACK_MODEL || 'gpt-4o-mini'

// --- OCR Specific APIs ---
export const OCR_API_URL = process.env.OCR_API_URL || LLM_API_URL
export const OCR_API_KEY = process.env.OCR_API_KEY || LLM_API_KEY
export const OCR_MODEL = process.env.OCR_MODEL || 'glm-ocr'
export const OCR_REFINEMENT_MODEL = process.env.OCR_REFINEMENT_MODEL || 'gemini-3.1-flash-lite'

export const TTS_API_KEY = process.env.TTS_API_KEY || LLM_API_KEY
export const TTS_MODEL = process.env.TTS_MODEL || 'gpt-4o-mini-tts'

// -- Default ADMIN user ---
export const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin'
export const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin'

// --- Limits & Configs ---
export const PAGE_SIZE_CHARS = 1500

export const MIME_OVERRIDES: Record<string, string> = {
  '.md': 'text/markdown; charset=utf-8',
}

export const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, HEAD, OPTIONS, DELETE',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, Accept, X-Custom-Llm-Url, X-Custom-Llm-Key, X-Custom-Llm-Model',
}
