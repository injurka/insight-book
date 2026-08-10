import { API_URL, CDN_URL } from '~/01.shared/lib/env'

function transformHttpUrl(path: string): string {
  const apiUploadsRegex = new RegExp(`^${API_URL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/?(api/)?uploads/`, 'i')

  if (apiUploadsRegex.test(path)) {
    const relativePath = path.replace(apiUploadsRegex, '')

    return CDN_URL ? `${CDN_URL}/${relativePath}` : path
  }

  if (CDN_URL && /\/api\/uploads\//i.test(path)) {
    const relativePath = path.replace(/^https?:\/\/[^/]+\/api\/uploads\//i, '')

    return `${CDN_URL}/${relativePath}`
  }

  return path
}

function getMediaUrl(path?: string | null): string {
  if (!path) {
    return ''
  }

  if (path.startsWith('data:') || path.startsWith('blob:')) {
    return path
  }

  if (path.startsWith('http://') || path.startsWith('https://')) {
    return transformHttpUrl(path)
  }

  if (CDN_URL) {
    const cleanPath = path.replace(/^\/?(api\/)?uploads\//, '').replace(/^\//, '')

    return `${CDN_URL}/${cleanPath}`
  }

  const cleanPath = path.startsWith('/') ? path : `/${path}`

  return `${API_URL}${cleanPath}`
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
  if (cleanHex.length === 3)
    cleanHex = cleanHex.split('').map(char => char + char).join('')

  const red = Number.parseInt(cleanHex.slice(0, 2), 16) || 0
  const green = Number.parseInt(cleanHex.slice(2, 4), 16) || 0
  const b = Number.parseInt(cleanHex.slice(4, 6), 16) || 0

  return `rgba(${red}, ${green}, ${b}, ${alpha})`
}

export { getMediaUrl }
