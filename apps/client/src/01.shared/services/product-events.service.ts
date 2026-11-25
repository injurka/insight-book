import type { QueuedProductEvent } from '~/01.shared/types/schemas/activity.schema'

const STORAGE_KEY = 'insight_product_events_queue'
const MAX_QUEUE_SIZE = 50
export const IMMEDIATE_FLUSH_BATCH_SIZE = 15

const CAPTURED_PRODUCT_EVENTS = new Set<string>([
  'register_success',
  'login_success',
  'pwa_installed',
  'book_uploaded',
  'custom_manga_created',
  'public_book_search',
  'public_book_downloaded',
  'book_opened',
  'reading_session_ended',
  'parallel_view_toggled',
  'tts_played',
  'ai_analyze',
  'ai_word_lookup',
  'book_full_analysis_started',
  'word_saved_to_dict',
  'deck_created',
  'srs_training_started',
  'srs_training_finished',
  'anki_export_downloaded',
])

const EVENT_COOLDOWN_MS: Record<string, number> = {
  public_book_search: 2_500,
  tts_played: 1_500,
}

const REDACTED_KEYS = new Set(['word', 'query', 'sentence', 'text', 'prompt', 'message', 'email'])

type FlushSubscriber = () => void

let queue: QueuedProductEvent[] | null = null
const lastEmittedAt = new Map<string, number>()
const subscribers = new Set<FlushSubscriber>()

function readPersistedQueue(): QueuedProductEvent[] {
  if (typeof sessionStorage === 'undefined')
    return []

  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)

    if (!raw)
      return []

    const parsed: unknown = JSON.parse(raw)

    return Array.isArray(parsed) ? (parsed as QueuedProductEvent[]).slice(0, MAX_QUEUE_SIZE) : []
  }
  catch {
    return []
  }
}

function persistQueue(items: QueuedProductEvent[]): void {
  if (typeof sessionStorage === 'undefined')
    return

  try {
    if (items.length === 0)
      sessionStorage.removeItem(STORAGE_KEY)
    else
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  }
  catch {
    // Ignore quota / unavailable storage errors
  }
}

function getQueue(): QueuedProductEvent[] {
  queue ??= readPersistedQueue()

  return queue
}

function coerceMetaEntry(key: string, val: unknown): [string, string | number | boolean | null] | null {
  if (val === undefined)
    return null

  if (REDACTED_KEYS.has(key)) {
    const len = typeof val === 'string' ? val.trim().length : 0

    return len > 0 ? [`${key}_len`, len] : null
  }

  if (val === null || typeof val === 'boolean')
    return [key, val]

  if (typeof val === 'number')
    return Number.isFinite(val) ? [key, Math.round(val * 100) / 100] : null

  return typeof val === 'string' ? [key, val.slice(0, 80)] : null
}

function sanitizeClientMeta(raw?: Record<string, unknown>): Record<string, string | number | boolean | null> | null {
  if (!raw || typeof raw !== 'object')
    return null

  const clean: Record<string, string | number | boolean | null> = {}
  let count = 0

  for (const [key, val] of Object.entries(raw)) {
    if (count >= 8)
      break

    const entry = coerceMetaEntry(key, val)

    if (entry) {
      clean[entry[0]] = entry[1]
      count++
    }
  }

  return count > 0 ? clean : null
}

export function enqueueProductEvent(eventName: string, eventData?: Record<string, unknown>): boolean {
  if (!CAPTURED_PRODUCT_EVENTS.has(eventName))
    return false

  const now = Date.now()
  const cooldown = EVENT_COOLDOWN_MS[eventName]

  if (cooldown) {
    const prev = lastEmittedAt.get(eventName)

    if (prev !== undefined && now - prev < cooldown)
      return false

    lastEmittedAt.set(eventName, now)
  }

  const items = getQueue()
  items.push({
    event: eventName,
    meta: sanitizeClientMeta(eventData),
    timestamp: new Date(now).toISOString(),
  })

  if (items.length > MAX_QUEUE_SIZE)
    items.splice(0, items.length - MAX_QUEUE_SIZE)

  persistQueue(items)

  if (items.length >= IMMEDIATE_FLUSH_BATCH_SIZE) {
    for (const notify of subscribers)
      notify()
  }

  return true
}

export function getPendingProductEventsCount(): number {
  return getQueue().length
}

export function drainProductEvents(maxItems: number = MAX_QUEUE_SIZE): QueuedProductEvent[] {
  const items = getQueue()

  if (items.length === 0)
    return []

  const batch = items.splice(0, maxItems)
  persistQueue(items)

  return batch
}

export function restoreProductEvents(failedBatch: QueuedProductEvent[]): void {
  if (failedBatch.length === 0)
    return

  const items = getQueue()
  items.unshift(...failedBatch)

  if (items.length > MAX_QUEUE_SIZE)
    items.length = MAX_QUEUE_SIZE

  persistQueue(items)
}

export function clearProductEventsQueue(): void {
  queue = []
  lastEmittedAt.clear()
  persistQueue([])
}

export function onProductEventsBatchReady(listener: FlushSubscriber): () => void {
  subscribers.add(listener)

  return () => {
    subscribers.delete(listener)
  }
}
