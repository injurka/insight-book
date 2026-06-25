/* eslint-disable no-console */
import type { ServiceWorkerMessage } from './model/types'
import { clientsClaim } from 'workbox-core'
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'
import { messageHandlers } from './lib/message-handlers'
import { AssetAnalyzer, CacheStrategyFactory } from './lib/utils'
import { CACHE_CONFIG } from './model/types'

declare let self: ServiceWorkerGlobalScope

clientsClaim()

cleanupOutdatedCaches()

precacheAndRoute(self.__WB_MANIFEST || [])

if (import.meta.env.PROD) {
  // WEB APP MANIFEST
  registerRoute(
    ({ request, sameOrigin, url }) => {
      if (!url.protocol.startsWith('http'))
        return false
      return sameOrigin && request.destination === 'manifest'
    },
    CacheStrategyFactory.createNetworkFirst(
      CACHE_CONFIG.names.webmanifest,
      {
        maxEntries: CACHE_CONFIG.limits.manifests,
        maxAgeSeconds: CACHE_CONFIG.durations.manifests,
      },
    ),
  )

  // FONTS
  registerRoute(
    ({ request, url }) => {
      if (!url.protocol.startsWith('http'))
        return false
      return request.destination === 'font'
    },
    CacheStrategyFactory.createCacheFirst(
      CACHE_CONFIG.names.fonts,
      {
        maxEntries: CACHE_CONFIG.limits.fonts,
        maxAgeSeconds: CACHE_CONFIG.durations.fonts,
        statuses: [0, 200],
      },
    ),
  )
}

// ICONS (Iconify)
registerRoute(
  ({ url }) => url.protocol.startsWith('http') && url.hostname === 'api.iconify.design',
  CacheStrategyFactory.createStaleWhileRevalidate(
    CACHE_CONFIG.names.icons,
    {
      maxEntries: CACHE_CONFIG.limits.icons,
      maxAgeSeconds: CACHE_CONFIG.durations.icons,
    },
  ),
)

// IMAGES
registerRoute(
  ({ request, url }) => {
    if (!url.protocol.startsWith('http'))
      return false

    if (request.destination === 'video' || request.destination === 'audio')
      return false

    return request.destination === 'image' || url.pathname.match(/\.(png|jpg|jpeg|svg|gif|webp)$/i)
  },
  CacheStrategyFactory.createStaleWhileRevalidate(
    CACHE_CONFIG.names.images,
    {
      maxEntries: CACHE_CONFIG.limits.images,
      maxAgeSeconds: CACHE_CONFIG.durations.images,
    },
  ),
)

// --- СТАТИЧЕСКИЕ АССЕТЫ (JS, CSS) ---

function isScriptOrStyle({ request, url }: { request: Request, url: URL }) {
  if (!url.protocol.startsWith('http'))
    return false
  return request.destination === 'script' || request.destination === 'style'
    || url.pathname.endsWith('.js') || url.pathname.endsWith('.css')
}

const hashedAssetsStrategy = CacheStrategyFactory.createCacheFirst(
  CACHE_CONFIG.names.hashedAssets,
  {
    maxEntries: CACHE_CONFIG.limits.hashedAssets,
    maxAgeSeconds: CACHE_CONFIG.durations.static.hashed,
  },
)

const vendorAssetsStrategy = CacheStrategyFactory.createCacheFirst(
  CACHE_CONFIG.names.vendorAssets,
  {
    maxEntries: CACHE_CONFIG.limits.vendorAssets,
    maxAgeSeconds: CACHE_CONFIG.durations.static.vendor,
    statuses: [0, 200],
  },
)

const regularAssetsStrategy = CacheStrategyFactory.createStaleWhileRevalidate(
  CACHE_CONFIG.names.regularAssets,
  {
    maxEntries: CACHE_CONFIG.limits.regularAssets,
    maxAgeSeconds: CACHE_CONFIG.durations.static.regular,
  },
)

registerRoute(
  options => isScriptOrStyle(options) && AssetAnalyzer.getAssetType(options.url.href) === 'hashed',
  hashedAssetsStrategy,
)

registerRoute(
  options => isScriptOrStyle(options) && AssetAnalyzer.getAssetType(options.url.href) === 'vendor',
  vendorAssetsStrategy,
)

registerRoute(
  options => isScriptOrStyle(options) && AssetAnalyzer.getAssetType(options.url.href) === 'regular',
  regularAssetsStrategy,
)

// --- SPA НАВИГАЦИЯ ---

let allowlist: undefined | RegExp[]
if (import.meta.env.DEV)
  allowlist = [/^\/$/]

let denylist: undefined | RegExp[]
if (import.meta.env.PROD) {
  denylist = [
    /^\/api\//,
    /^\/sw\.js$/,
    /^\/manifest-(.*)\.webmanifest$/,
    /^\/workbox-.*\.js$/,
  ]
}

registerRoute(new NavigationRoute(
  createHandlerBoundToURL('/'),
  {
    allowlist,
    denylist,
  },
))

// --- ОБРАБОТКА СООБЩЕНИЙ ---

self.addEventListener('message', async (event) => {
  const { type, payload } = event.data as ServiceWorkerMessage
  const port = event.ports[0]

  const handler = messageHandlers[type]
  if (handler) {
    try {
      await handler(port, payload)
    }
    catch (error) {
      console.error(`Ошибка при обработке сообщения "${type}":`, error)
      if (port) {
        port.postMessage({
          type: 'ERROR',
          payload: { message: `Внутренняя ошибка при обработке: ${type}` },
        })
      }
    }
  }
  else {
    if (port) {
      port.postMessage({
        type: 'ERROR',
        payload: { message: `Неизвестный тип сообщения: ${type}` },
      })
    }
  }
})

if (import.meta.env.DEV) {
  console.log('🔧 Service Worker в режиме разработки')

  self.addEventListener('fetch', (event) => {
    if (event.request.method === 'GET') {
      const assetType = AssetAnalyzer.getAssetType(event.request.url)
      if (!event.request.url.includes('/api/')) {
        console.log(`📥 ${assetType}: ${event.request.url}`)
      }
    }
  })
}

self.addEventListener('push', (event: PushEvent) => {
  if (event.data) {
    try {
      const data = event.data.json()

      const options = {
        body: data.body,
        icon: data.icon || '/logo.png', // Android плохо переваривает SVG в пушах
        badge: data.badge || '/logo.png',
        data: {
          url: data.url || '/',
        },
        vibrate: [200, 100, 200],
      }

      event.waitUntil(self.registration.showNotification(data.title, options as any))
    }
    catch {
      event.waitUntil(self.registration.showNotification('InsightBook', { body: event.data.text() }))
    }
  }
})

self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close()
  const urlToOpen = event.notification.data?.url || '/'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i]
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          // Вместо перезагрузки SPA используем обмен сообщениями для навигации
          client.postMessage({ type: 'NAVIGATE', url: urlToOpen })
          return client.focus()
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(urlToOpen)
      }
    }),
  )
})
