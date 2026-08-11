import { Elysia } from 'elysia'

/**
 * Именованные профили кеширования.
 * Используй декларативно в конфиге роута:
 *   .get('/', handler, { cache: 'shortPublic' })
 * вместо императивного:
 *   .get('/', ({ set }) => { set.headers['Cache-Control'] = '...'; return handler() })
 */
export const CACHE_PROFILES = {
  /** Публичные списки: каталог книг, книги юзера */
  shortPublic: 'public, max-age=30, stale-while-revalidate=120',
  /** Публичный каталог плагинов, детали плагина */
  mediumPublic: 'public, max-age=60, stale-while-revalidate=300',
  /** Каталог словарей, слова колоды */
  longPublic: 'public, max-age=300, stale-while-revalidate=600',
  /** Файлы с версионированным URL */
  hourPublic: 'public, max-age=3600',
  /** Контент книги (текст страницы) */
  dayPublic: 'public, max-age=86400',
  /** Неизменяемые ассеты: обложки, аватарки, изображения манги */
  immutable: 'public, max-age=31536000, immutable',

  /** Приватные данные юзера: инфо о книге, оглавление */
  shortPrivate: 'private, no-cache, no-store, must-revalidate',
  /** Приватный словарь страницы */
  dayPrivate: 'private, max-age=86400',
} as const

export type CacheProfile = keyof typeof CACHE_PROFILES

/**
 * Elysia-плагин. Добавляет макрос `cache`, который регистрирует `onAfterHandle`
 * для установки заголовка Cache-Control согласно выбранному профилю.
 *
 * Использование:
 *   import { cachePlugin } from '~/utils/cache'
 *   new Elysia().use(cachePlugin).get('/', handler, { cache: 'shortPublic' })
 */
export const cachePlugin = new Elysia({ name: 'cache' })
  .macro({
    cache(profile: CacheProfile) {
      return {
        afterHandle: ({ set }: { set: { headers: Record<string, string | number> } }) => {
          set.headers['Cache-Control'] = CACHE_PROFILES[profile]
        },
      }
    },
  })
