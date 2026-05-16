import { AppError } from './errors'

interface RateLimitStore {
  count: number
  resetTime: number
}

/**
 * Создает простой In-Memory Rate Limiter
 * @param maxRequests Максимальное количество запросов
 * @param windowMs Временное окно в миллисекундах
 */
export function createRateLimiter(maxRequests: number, windowMs: number) {
  const store = new Map<string, RateLimitStore>()

  // Периодическая очистка старых записей для предотвращения утечек памяти
  setInterval(() => {
    const now = Date.now()
    for (const [key, value] of store.entries()) {
      if (now > value.resetTime) {
        store.delete(key)
      }
    }
  }, windowMs)

  return function checkLimit(key: string) {
    const now = Date.now()
    let record = store.get(key)

    if (!record || now > record.resetTime) {
      record = { count: 0, resetTime: now + windowMs }
    }

    record.count += 1
    store.set(key, record)

    if (record.count > maxRequests) {
      throw new AppError(429, 'Слишком много запросов. Пожалуйста, подождите немного.')
    }
  }
}

/**
 * Получает IP адрес клиента из заголовков (учитывая прокси Nginx)
 */
export function getClientIp(req: Request): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]
    || req.headers.get('x-real-ip')
    || 'unknown-ip'
}
