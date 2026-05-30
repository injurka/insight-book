import { AppError } from './errors'

interface RateLimitStore {
  count: number
  resetAt: number
}

/**
 * Оптимизированный In-Memory Rate Limiter без утечек памяти (lazy evaluation)
 * @param maxRequests Максимальное количество запросов
 * @param windowMs Временное окно в миллисекундах
 */
export function createRateLimiter(maxRequests: number, windowMs: number) {
  const store = new Map<string, RateLimitStore>()

  const cleanupInterval = setInterval(() => {
    const now = Date.now()
    for (const [key, record] of store.entries()) {
      if (now > record.resetAt) {
        store.delete(key)
      }
    }
  }, windowMs * 2)

  if (cleanupInterval.unref) {
    cleanupInterval.unref()
  }

  return function checkLimit(key: string) {
    const now = Date.now()
    let record = store.get(key)

    if (!record || now > record.resetAt) {
      record = { count: 0, resetAt: now + windowMs }
      store.set(key, record)
    }

    record.count += 1

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
