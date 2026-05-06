import path from 'node:path'

export const PORT = Number.parseInt(process.env.PORT || '4444')
export const BASE_PATH = process.env.FS_BASE_PATH || ''

export const DB_PATH = process.env.DB_PATH || path.resolve(process.cwd(), 'db', 'insight-book.sqlite')
export const DICTS_PATH = process.env.DICTS_PATH || path.resolve(process.cwd(), 'db', 'dicts')

export const UPLOADS_PATH = process.env.UPLOADS_PATH || path.resolve(process.cwd(), 'uploads')

export const LLM_API_KEY = process.env.LLM_API_KEY || ''
export const LLM_API_URL = process.env.LLM_API_URL || 'https://aihubmix.com/v1'
export const LLM_MODEL = process.env.LLM_MODEL || 'gemini-3.1-flash-lite-preview'
export const LLM_FALLBACK_MODEL = process.env.LLM_FALLBACK_MODEL || 'gpt-4o-mini'

export const TTS_API_KEY = process.env.TTS_API_KEY || LLM_API_KEY
export const TTS_MODEL = process.env.TTS_MODEL || 'gpt-4o-mini-tts'

export const PAGE_SIZE_CHARS = 1500

export const MIME_OVERRIDES: Record<string, string> = {
  '.md': 'text/markdown; charset=utf-8',
}

export const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, HEAD, OPTIONS, DELETE',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, Accept',
}
