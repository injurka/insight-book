/* eslint-disable no-console */
import type { WorkboxPlugin } from 'workbox-core'
import type { AssetType, CacheInfo } from '../model/types'
import { CacheableResponsePlugin } from 'workbox-cacheable-response'
import { ExpirationPlugin } from 'workbox-expiration'
import { CacheFirst, NetworkFirst, StaleWhileRevalidate } from 'workbox-strategies'

class AssetAnalyzer {
  private static cache = new Map<string, AssetType>()

  static HASH_PATTERNS = [
    /\.[a-f0-9]{8,}\.(js|css|mjs)$/i,
    /\.[a-f0-9]{6,12}\.(js|css|mjs)$/i,
    /assets\/.*\.[a-f0-9]{8,}\./i,
    /\?v=[a-f0-9]{8,}/i,
  ]

  static VENDOR_PATTERNS = [
    /node_modules/i,
    /vendor/i,
    /\/lib\//i,
    /cdn\./i,
    /unpkg\.com/i,
    /jsdelivr\.net/i,
  ]

  static isHashedAsset(url: string): boolean {
    return this.HASH_PATTERNS.some(pattern => pattern.test(url))
  }

  static isVendorAsset(url: string): boolean {
    return this.VENDOR_PATTERNS.some(pattern => pattern.test(url))
  }

  static getAssetType(url: string) {
    if (this.cache.has(url)) {
      const existingType = this.cache.get(url)!
      this.cache.delete(url)
      this.cache.set(url, existingType)
      return existingType
    }

    let type: 'hashed' | 'vendor' | 'regular' = 'regular'

    if (this.isHashedAsset(url))
      type = 'hashed'
    else if (this.isVendorAsset(url))
      type = 'vendor'

    if (this.cache.size >= 1000) {
      const oldestKey = this.cache.keys().next().value
      if (oldestKey) {
        this.cache.delete(oldestKey)
      }
    }

    this.cache.set(url, type)
    return type
  }
}

const safeCachePlugin: WorkboxPlugin = {
  cacheWillUpdate: async ({ response }) => {
    if (!response)
      return null
    if (response.status === 206)
      return null
    if (response.type === 'error')
      return null
    if (response.type !== 'opaque' && response.headers.has('vary') && response.headers.get('vary')?.includes('*')) {
      return null
    }
    return response
  },
}
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
        safeCachePlugin,
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
        safeCachePlugin,
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
        safeCachePlugin,
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
    if (import.meta.env.DEV) {
      console.log(`🎯 Cache HIT: ${cacheName} - ${url}`)
    }
  }

  static trackCacheMiss(cacheName: string, url: string) {
    if (import.meta.env.DEV) {
      console.log(`❌ Cache MISS: ${cacheName} - ${url}`)
    }
  }
}

function createMonitoringPlugin(cacheName: string): WorkboxPlugin {
  return {
    cachedResponseWillBeUsed: async ({ request, cachedResponse }) => {
      if (cachedResponse) {
        ServiceWorkerMonitor.trackCacheHit(cacheName, request.url)
      }
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

    await Promise.all(
      cacheNames.map(async (name) => {
        try {
          const cache = await caches.open(name)
          const keys = await cache.keys()

          let totalSize = 0
          if (import.meta.env.DEV) {
            const responses = await Promise.all(
              keys.slice(0, 10).map(req => cache.match(req)),
            )
            totalSize = responses.reduce((sum, response) => {
              return sum + (response?.headers.get('content-length')
                ? Number.parseInt(response.headers.get('content-length')!)
                : 0)
            }, 0)
          }

          info.push({
            name,
            size: keys.length,
            urls: keys.slice(0, 5).map(req => req.url),
            totalSize,
          })
        }
        catch (error) {
          console.warn(`Ошибка получения информации о кеше ${name}:`, error)
        }
      }),
    )

    return info
  }
  catch (error) {
    console.error('Ошибка получения информации о кешах:', error)
    return []
  }
}

export {
  AssetAnalyzer,
  CacheStrategyFactory,
  getCacheInfo,
  ServiceWorkerMonitor,
}
