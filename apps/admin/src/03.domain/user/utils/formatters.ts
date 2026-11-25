import type { UserLifecycleSegment } from '~/01.shared/types/models'

/**
 * Formats token count or limit into human readable format (e.g. 1.5M, 200K, or ∞ if limit is null/undefined/unlimited)
 */
export function formatTokens(n: number | null | undefined): string {
  if (n === null || n === undefined || n < 0)
    return '∞'
  if (n >= 1_000_000)
    return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)
    return `${(n / 1_000).toFixed(0)}K`

  return String(n)
}

/**
 * Formats book limit (or ∞ if null/undefined/unlimited)
 */
export function formatLimit(n: number | null | undefined): string {
  if (n === null || n === undefined || n < 0)
    return '∞'

  return String(n)
}

/**
 * Formats duration in seconds into a concise Russian label (e.g. "2 ч 15 мин", "14 мин", "45 сек").
 */
export function formatDuration(seconds: number | null | undefined): string {
  const total = Math.max(0, Math.round(seconds ?? 0))

  if (total === 0)
    return '—'

  if (total < 60)
    return `${total} сек`

  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)

  if (hours === 0)
    return `${minutes} мин`

  if (minutes === 0 || hours >= 24)
    return `${hours} ч`

  return `${hours} ч ${minutes} мин`
}

const SQLITE_DATETIME_RE = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(?::\d{2})?$/

/**
 * Parses server timestamps. SQLite `datetime('now')` values carry no timezone and are UTC,
 * while `new Date('YYYY-MM-DD HH:MM:SS')` would treat them as local time.
 */
export function parseServerDate(value: string | null | undefined): Date | null {
  if (!value)
    return null

  const normalized = SQLITE_DATETIME_RE.test(value) ? `${value.replace(' ', 'T')}Z` : value
  const parsed = new Date(normalized)

  return Number.isNaN(parsed.getTime()) ? null : parsed
}

/**
 * Formats server timestamp as a short local date (e.g. "13.05.2026").
 */
export function formatDate(value: string | null | undefined): string {
  return parseServerDate(value)?.toLocaleDateString('ru-RU') ?? '—'
}

/**
 * Formats ISO/SQLite timestamp into a compact relative Russian label.
 */
export function formatRelativeTime(value: string | null | undefined): string {
  const parsed = parseServerDate(value)

  if (!parsed)
    return 'Нет данных'

  const diffMs = Date.now() - parsed.getTime()

  if (diffMs < 60_000)
    return 'Только что'

  const diffMinutes = Math.floor(diffMs / 60_000)

  if (diffMinutes < 60)
    return `${diffMinutes} мин назад`

  const diffHours = Math.floor(diffMs / 3_600_000)

  if (diffHours < 24)
    return `${diffHours} ч назад`

  const diffDays = Math.floor(diffMs / 86_400_000)

  if (diffDays === 1)
    return 'Вчера'

  if (diffDays < 30)
    return `${diffDays} дн. назад`

  return parsed.toLocaleDateString('ru-RU')
}

/**
 * Formats USD LLM cost neatly.
 */
export function formatCost(usd: number | null | undefined): string {
  const val = usd ?? 0

  if (val <= 0)
    return '$0.00'

  if (val < 0.01)
    return `$${val.toFixed(4)}`

  return `$${val.toFixed(2)}`
}

export interface SegmentMeta {
  label: string
  shortLabel: string
  description: string
  badgeVariant: 'active' | 'cooling' | 'inactive' | 'never_activated'
  color: string
  bgColor: string
  icon: string
}

export const SEGMENT_META: Record<UserLifecycleSegment, SegmentMeta> = {
  active: {
    label: 'Активные',
    shortLabel: 'Активен',
    description: 'Заходили за последние 7 дней',
    badgeVariant: 'active',
    color: '#4b8266',
    bgColor: '#e4eee6',
    icon: 'mdi:pulse',
  },
  cooling: {
    label: 'Остывающие',
    shortLabel: 'Остывает',
    description: 'Были 8–30 дней назад',
    badgeVariant: 'cooling',
    color: '#b38f2b',
    bgColor: '#fcf4dd',
    icon: 'mdi:weather-sunset-down',
  },
  inactive: {
    label: 'Неактивные',
    shortLabel: 'Неактивен',
    description: 'Не заходили больше 30 дней',
    badgeVariant: 'inactive',
    color: '#c46d6d',
    bgColor: '#f5e3e3',
    icon: 'mdi:sleep',
  },
  never_activated: {
    label: 'Не активированы',
    shortLabel: 'Не активирован',
    description: 'Зарегистрировались, но ещё не начали',
    badgeVariant: 'never_activated',
    color: '#617a94',
    bgColor: '#e0e7ee',
    icon: 'mdi:account-clock-outline',
  },
}

export function getSegmentMeta(segment: UserLifecycleSegment): SegmentMeta {
  return SEGMENT_META[segment] ?? SEGMENT_META.never_activated
}

export type UsageLevel = 'ok' | 'warn' | 'danger'

/**
 * Share of a limit that is already used, in whole percent (0 for unlimited / empty limits).
 */
export function usagePercent(used: number, limit: number | null | undefined): number {
  if (limit === null || limit === undefined || limit <= 0)
    return 0

  return Math.min(100, Math.round((used / limit) * 100))
}

export function getUsageLevel(percent: number): UsageLevel {
  if (percent >= 100)
    return 'danger'

  return percent >= 80 ? 'warn' : 'ok'
}
