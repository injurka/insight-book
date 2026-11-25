import type { EventMetaRecord, ProductEventCategory } from '~/01.shared/types/models'
import { formatDuration } from './formatters'

export interface EventCategoryVisualMeta {
  label: string
  icon: string
  color: string
  bgColor: string
}

export const EVENT_CATEGORY_META: Record<ProductEventCategory, EventCategoryVisualMeta> = {
  reader: {
    label: 'Читалка',
    icon: 'mdi:book-open-variant',
    color: '#4b8266',
    bgColor: '#e4eee6',
  },
  ai: {
    label: 'AI-анализ',
    icon: 'mdi:sparkles',
    color: '#b38f2b',
    bgColor: '#fcf4dd',
  },
  learning: {
    label: 'Словарь и SRS',
    icon: 'mdi:cards-outline',
    color: '#3f6b56',
    bgColor: '#e3eae6',
  },
  library: {
    label: 'Библиотека',
    icon: 'mdi:bookshelf',
    color: '#617a94',
    bgColor: '#e0e7ee',
  },
  auth: {
    label: 'Аккаунт',
    icon: 'mdi:account-check-outline',
    color: '#7a6f62',
    bgColor: '#dfd7cc',
  },
}

const DIRECT_KEY_LABELS: Record<string, (val: string | number | boolean) => string> = {
  duration_seconds: val => formatDuration(Number(val)),
  timeSpentSeconds: val => formatDuration(Number(val)),
  bookId: val => `книга #${val}`,
  book_id: val => `книга #${val}`,
  language: val => String(val).toUpperCase(),
  lang: val => String(val).toUpperCase(),
  format: val => String(val).toUpperCase(),
  type: val => String(val).toUpperCase(),
  size_mb: val => `${val} МБ`,
  accuracy: val => `точность ${val}%`,
  totalAnswers: val => `${val} отв.`,
  score: val => `${val}%`,
  level: val => `ур. ${val}`,
  passed: val => (val ? 'сдан' : 'не сдан'),
  mode: val => `режим: ${val}`,
  pluginId: val => String(val),
  voice: val => String(val),
  query_len: val => `запрос (${val} симв.)`,
  word_len: val => `слово (${val} симв.)`,
}

/**
 * Formats flat event metadata into compact human-readable Russian badges.
 */
export function formatEventMetaTags(meta: EventMetaRecord | null | undefined): string[] {
  if (!meta)
    return []

  const tags: string[] = []

  for (const [key, val] of Object.entries(meta)) {
    if (val === null || val === undefined || val === '')
      continue

    const formatter = DIRECT_KEY_LABELS[key]
    tags.push(formatter ? formatter(val) : `${key}: ${String(val)}`)
  }

  return tags
}

/**
 * Formats median funnel transition minutes into a readable label.
 */
export function formatTransitionMinutes(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined)
    return ''

  if (minutes < 1)
    return '< 1 мин'

  if (minutes < 60)
    return `~${Math.round(minutes)} мин`

  const hours = minutes / 60

  if (hours < 24)
    return `~${hours.toFixed(1)} ч`

  return `~${(hours / 24).toFixed(1)} дн.`
}
