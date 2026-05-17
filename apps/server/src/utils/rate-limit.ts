import { AppError } from './errors'

interface RateLimitStore {
  count: number
  timer: ReturnType<typeof setTimeout>
}

/**
 * Создает простой In-Memory Rate Limiter без утечек памяти
 * @param maxRequests Максимальное количество запросов
 * @param windowMs Временное окно в миллисекундах
 */
export function createRateLimiter(maxRequests: number, windowMs: number) {
  const store = new Map<string, RateLimitStore>()

  return function checkLimit(key: string) {
    let record = store.get(key)

    if (!record) {
      // Инициализируем запись и ставим таймер на очистку
      const timer = setTimeout(() => {
        store.delete(key)
      }, windowMs)

      record = { count: 0, timer }
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
