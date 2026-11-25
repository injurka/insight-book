export const USER_EVENTS_RETENTION_DAYS = 90
export const MAX_EVENTS_PER_BATCH = 50
export const MAX_META_KEYS = 8
export const MAX_META_STRING_LENGTH = 80

export type ProductEventCategory = 'auth' | 'library' | 'reader' | 'ai' | 'learning'

export interface ProductEventDefinition {
  name: string
  category: ProductEventCategory
  label: string
}

export const PRODUCT_EVENT_CATALOG = [
  // Auth & App
  { name: 'register_success', category: 'auth', label: 'Регистрация аккаунта' },
  { name: 'login_success', category: 'auth', label: 'Вход в аккаунт' },
  { name: 'pwa_installed', category: 'auth', label: 'Установка PWA' },

  // Library & Catalog
  { name: 'book_uploaded', category: 'library', label: 'Загрузка своей книги' },
  { name: 'custom_manga_created', category: 'library', label: 'Создание манги' },
  { name: 'public_book_search', category: 'library', label: 'Поиск в публичном каталоге' },
  { name: 'public_book_downloaded', category: 'library', label: 'Скачивание публичной книги' },

  // Reader
  { name: 'book_opened', category: 'reader', label: 'Открытие книги в читалке' },
  { name: 'reading_session_ended', category: 'reader', label: 'Завершение сессии чтения' },
  { name: 'parallel_view_toggled', category: 'reader', label: 'Параллельный перевод в читалке' },
  { name: 'tts_played', category: 'reader', label: 'Озвучивание текста (TTS)' },

  // AI & Lexical Analysis
  { name: 'ai_analyze', category: 'ai', label: 'AI-разбор предложения' },
  { name: 'ai_word_lookup', category: 'ai', label: 'AI-разбор слова' },
  { name: 'book_full_analysis_started', category: 'ai', label: 'Полный анализ книги' },

  // Dictionary, SRS, Quizzes & Plugins
  { name: 'word_saved_to_dict', category: 'learning', label: 'Сохранение слова в словарь' },
  { name: 'deck_created', category: 'learning', label: 'Создание колоды слов' },
  { name: 'srs_training_started', category: 'learning', label: 'Старт SRS-тренировки' },
  { name: 'srs_training_finished', category: 'learning', label: 'Завершение SRS-тренировки' },
  { name: 'anki_export_downloaded', category: 'learning', label: 'Экспорт колоды в Anki' },
  { name: 'quiz_completed', category: 'learning', label: 'Прохождение квиза' },
  { name: 'plugin_installed', category: 'learning', label: 'Установка плагина' },
] as const satisfies readonly ProductEventDefinition[]

export type ProductEventName = (typeof PRODUCT_EVENT_CATALOG)[number]['name']

export type EventMetaPrimitive = string | number | boolean | null
export type EventMetaRecord = Record<string, EventMetaPrimitive>

const ALLOWED_EVENT_SET = new Set<string>(PRODUCT_EVENT_CATALOG.map(e => e.name))

/** Fields that may contain arbitrary user-typed text or content — never persist raw values. */
const REDACTED_TEXT_KEYS = new Set(['word', 'query', 'sentence', 'text', 'prompt', 'message', 'email'])

export function isAllowedProductEvent(event: string): event is ProductEventName {
  return ALLOWED_EVENT_SET.has(event)
}

/**
 * Sanitizes event metadata into a compact, flat JSON record without PII or unbounded strings.
 */
export function sanitizeEventMeta(raw: unknown): EventMetaRecord | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw))
    return null

  const result: EventMetaRecord = {}
  let count = 0

  for (const [rawKey, rawVal] of Object.entries(raw as Record<string, unknown>)) {
    if (count >= MAX_META_KEYS)
      break

    const key = rawKey.trim().slice(0, 40)

    if (!key || rawVal === undefined)
      continue

    if (REDACTED_TEXT_KEYS.has(key)) {
      if (typeof rawVal === 'string' && rawVal.trim().length > 0) {
        result[`${key}_len`] = rawVal.trim().length
        count++
      }

      continue
    }

    if (rawVal === null || typeof rawVal === 'boolean') {
      result[key] = rawVal
      count++
    }
    else if (typeof rawVal === 'number') {
      if (Number.isFinite(rawVal)) {
        result[key] = Math.round(rawVal * 100) / 100
        count++
      }
    }
    else if (typeof rawVal === 'string') {
      result[key] = rawVal.slice(0, MAX_META_STRING_LENGTH)
      count++
    }
  }

  return count > 0 ? result : null
}

/**
 * Clamps client-provided event timestamps so clock skew cannot create future or ancient rows.
 */
export function normalizeEventTimestamp(rawTimestamp?: string | null, nowMs: number = Date.now()): string {
  const maxFutureMs = nowMs + 5 * 60 * 1000
  const minPastMs = nowMs - 7 * 24 * 60 * 60 * 1000

  if (rawTimestamp) {
    const parsedMs = Date.parse(rawTimestamp)

    if (!Number.isNaN(parsedMs)) {
      const clamped = Math.min(maxFutureMs, Math.max(minPastMs, parsedMs))

      return new Date(clamped).toISOString()
    }
  }

  return new Date(nowMs).toISOString()
}
