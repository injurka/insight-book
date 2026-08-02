/* eslint-disable no-console */
import type { WorkboxPlugin } from 'workbox-core'
import type { CacheInfo } from '../model/types'
import { CacheableResponsePlugin } from 'workbox-cacheable-response'
import { ExpirationPlugin } from 'workbox-expiration'
import { CacheFirst, NetworkFirst, StaleWhileRevalidate } from 'workbox-strategies'

class CacheStrategyFactory {
  static createNetworkFirst(cacheName: string, options: {
    maxEntries: number
    maxAgeSeconds: number
  }) {
    return new NetworkFirst({
      cacheName,
      plugins: [
        createMonitoringPlugin(cacheName),
        new CacheableResponsePlugin({
          statuses: [0, 200],
        }),
        new ExpirationPlugin({
          maxEntries: options.maxEntries,
          maxAgeSeconds: options.maxAgeSeconds,
        }),
      ],
    })
  }

  static createCacheFirst(cacheName: string, options: {
    maxEntries: number
    maxAgeSeconds: number
    statuses?: number[]
  }) {
    return new CacheFirst({
      cacheName,
      plugins: [
        createMonitoringPlugin(cacheName),
        new CacheableResponsePlugin({
          statuses: options.statuses || [0, 200],
        }),
        new ExpirationPlugin({
          maxEntries: options.maxEntries,
          maxAgeSeconds: options.maxAgeSeconds,
          purgeOnQuotaError: true,
        }),
      ],
    })
  }

  static createStaleWhileRevalidate(cacheName: string, options: {
    maxEntries: number
    maxAgeSeconds: number
  }) {
    return new StaleWhileRevalidate({
      cacheName,
      plugins: [
        createMonitoringPlugin(cacheName),
        new CacheableResponsePlugin({ statuses: [0, 200] }),
        new ExpirationPlugin({
          maxEntries: options.maxEntries,
          maxAgeSeconds: options.maxAgeSeconds,
        }),
      ],
    })
  }
}

class ServiceWorkerMonitor {
  static trackCacheHit(cacheName: string, url: string) {
    if (import.meta.env.DEV)
      console.log(`🎯 Cache HIT: ${cacheName} - ${url}`)
  }

  static trackCacheMiss(cacheName: string, url: string) {
    if (import.meta.env.DEV)
      console.log(`❌ Cache MISS: ${cacheName} - ${url}`)
  }
}

function createMonitoringPlugin(cacheName: string): WorkboxPlugin {
  return {
    cachedResponseWillBeUsed: async ({ request, cachedResponse }) => {
      if (cachedResponse)
        ServiceWorkerMonitor.trackCacheHit(cacheName, request.url)

      return cachedResponse
    },
    fetchDidSucceed: async ({ request, response }) => {
      ServiceWorkerMonitor.trackCacheMiss(cacheName, request.url)

      return response
    },
  }
}

async function getCacheInfo(): Promise<CacheInfo[]> {
  try {
    const cacheNames = await caches.keys()
    const info: CacheInfo[] = []

    await Promise.all(cacheNames.map(async (name) => {
      try {
        const cache = await caches.open(name)
        const keys = await cache.keys()

        info.push({
          name,
          size: keys.length,
          urls: keys.slice(0, 5).map(req => req.url),
          totalSize: 0,
        })
      }
      catch (error) {
        console.warn(`Ошибка получения информации о кеше ${name}:`, error)
      }
    }))

    return info
  }
  catch (error) {
    console.error('Ошибка получения информации о кешах:', error)

    return []
  }
}

export {
  CacheStrategyFactory,
  getCacheInfo,
  ServiceWorkerMonitor,
}
