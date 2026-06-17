import { i18n } from '~/shared/plugins/i18n'

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

export function formatPagesList(pages: number[]): string {
  const t = i18n.global.t
  if (pages.length === 0)
    return t('settings.noSavedPages', 'Нет сохраненных страниц')

  const sorted = [...pages].sort((a, b) => a - b)
  if (sorted.length <= 15)
    return sorted.join(', ')
  return `${sorted.slice(0, 15).join(', ')} ... ${t('settings.andMore', { count: sorted.length - 15 }, `и ещё ${sorted.length - 15}`)}`
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
