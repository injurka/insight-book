function getMediaUrl(path: string) {
  if (path.startsWith('data:'))
    return path

  const BASE = import.meta.env.VITE_API_URL || 'https://insight-api.trip-scheduler.ru'

  return `${BASE}${path}`
}

export { getMediaUrl }
