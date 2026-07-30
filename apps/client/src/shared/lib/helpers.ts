import { API_URL } from '~/shared/lib/env'

function getMediaUrl(path: string) {
  if (path.startsWith('data:') || path.startsWith('http://') || path.startsWith('https://'))
    return path

  return `${API_URL}${path}`
}

export function normalizeString(str: string): string {
  return (str || '')
    .replace(/[\s\u200B-\u200D\p{P}\p{S}]+/gu, '')
    .toLowerCase()
}

export function hexToRgba(hex: string, alpha: number): string {
  if (!hex)
    return `rgba(0, 0, 0, ${alpha})`

  const colorMap: Record<string, string> = {
    yellow: '#fde047',
    green: '#86efac',
    pink: '#f472b6',
    blue: '#93c5fd',
    purple: '#c4b5fd',
  }
  const resolvedHex = colorMap[hex.toLowerCase()] || hex

  let cleanHex = resolvedHex.replace('#', '')
  if (cleanHex.length === 3) {
    cleanHex = cleanHex.split('').map(c => c + c).join('')
  }
  const r = Number.parseInt(cleanHex.slice(0, 2), 16) || 0
  const g = Number.parseInt(cleanHex.slice(2, 4), 16) || 0
  const b = Number.parseInt(cleanHex.slice(4, 6), 16) || 0
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

export { getMediaUrl }
