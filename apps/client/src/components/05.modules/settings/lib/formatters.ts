import type { PageRange } from '../model'
import { i18n } from '~/shared/plugins/i18n'

export type { PageRange }

export function formatBytes(bytes: number, decimals = 2): string {
  const t = i18n.global.t
  if (bytes === 0 || !bytes)
    return `0 ${t('settings.bytes', 'Байт')}`
  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = [
    t('settings.bytes', 'Байт'),
    t('settings.kb', 'КБ'),
    t('settings.mb', 'МБ'),
    t('settings.gb', 'ГБ'),
    t('settings.tb', 'ТБ'),
  ]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${Number.parseFloat((bytes / k ** i).toFixed(dm))} ${sizes[i]}`
}

export type { PageRange }

/**
 * Схлопывает список страниц в непрерывные диапазоны:
 * [1, 2, 3, 5, 6, 10] -> [{1-3}, {5-6}, {10}]
 */
export function collapsePageRanges(pages: number[]): PageRange[] {
  if (!pages || pages.length === 0)
    return []

  const sorted = [...new Set(pages)].sort((a, b) => a - b)
  const ranges: PageRange[] = []

  for (const page of sorted) {
    const last = ranges[ranges.length - 1]
    if (last && page === last.end + 1) {
      last.end = page
    }
    else {
      ranges.push({ start: page, end: page })
    }
  }

  return ranges
}

export function formatPageRange(range: PageRange): string {
  return range.start === range.end
    ? `${range.start}`
    : `${range.start}–${range.end}`
}

export function formatPagesList(pages: number[], maxRanges = 20): string {
  const t = i18n.global.t
  if (pages.length === 0)
    return t('settings.noSavedPages', 'Нет сохраненных страниц')

  const ranges = collapsePageRanges(pages)
  if (ranges.length <= maxRanges)
    return ranges.map(formatPageRange).join(', ')

  const visible = ranges.slice(0, maxRanges).map(formatPageRange).join(', ')
  const hidden = ranges.length - maxRanges
  return `${visible} ... ${t('settings.andMore', { count: hidden }, `и ещё ${hidden}`)}`
}

export function formatNumber(num: number | undefined | null, locale = 'ru-RU'): string {
  if (num === undefined || num === null)
    return '0'
  return new Intl.NumberFormat(locale).format(num)
}

export function formatCurrency(num: number | undefined | null): string {
  if (num === undefined || num === null || num === 0)
    return '$0.00'

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: num < 0.01 ? 4 : 2,
  }).format(num)
}
