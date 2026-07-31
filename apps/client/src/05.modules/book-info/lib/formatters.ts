export function formatNumber(num: number | undefined | null): string {
  if (num === undefined || num === null)
    return '0'
  return new Intl.NumberFormat('ru-RU').format(num)
}
