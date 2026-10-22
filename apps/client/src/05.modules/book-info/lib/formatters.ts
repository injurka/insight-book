export function formatNumber(num: number | undefined | null): string {
  if (num === undefined || num === null)
    return '0'

  return new Intl.NumberFormat('ru-RU').format(num)
}

export function calculateProgressPercent(done: number, total: number): number {
  if (total <= 0 || done <= 0)
    return 0

  const percent = (done / total) * 100

  if (percent >= 100)
    return 100

  return Math.max(0.1, Math.round(percent * 10) / 10)
}

export function formatPercent(percent: number, locale = 'ru-RU'): string {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(percent)
}
