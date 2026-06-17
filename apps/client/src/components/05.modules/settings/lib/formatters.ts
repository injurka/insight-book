export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0 || !bytes)
    return '0 Байт'
  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ['Байт', 'КБ', 'МБ', 'ГБ', 'ТБ']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${Number.parseFloat((bytes / k ** i).toFixed(dm))} ${sizes[i]}`
}

export function formatPagesList(pages: number[]): string {
  if (pages.length === 0)
    return 'Нет сохраненных страниц'

  const sorted = [...pages].sort((a, b) => a - b)
  if (sorted.length <= 15)
    return sorted.join(', ')
  return `${sorted.slice(0, 15).join(', ')} ... и ещё ${sorted.length - 15}`
}

export function formatNumber(num: number | undefined | null, locale = 'ru-RU'): string {
  if (num === undefined || num === null)
    return '0'
  return new Intl.NumberFormat(locale).format(num)
}
