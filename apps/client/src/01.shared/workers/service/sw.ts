/* eslint-disable no-console */
import type { ServiceWorkerMessage } from './model/types'
import { clientsClaim } from 'workbox-core'
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'
import { messageHandlers } from './lib/message-handlers'
import { CacheStrategyFactory } from './lib/utils'
import { CACHE_CONFIG } from './model/types'

declare let self: ServiceWorkerGlobalScope

clientsClaim()

cleanupOutdatedCaches()

precacheAndRoute(self.__WB_MANIFEST || [])

function getMimeTypeFromExt(ext: string): string {
  if (ext === 'jpg' || ext === 'jpeg')
    return 'image/jpeg'
  if (ext === 'png')
    return 'image/png'
  if (ext === 'webp')
    return 'image/webp'
  if (ext === 'mp3')
    return 'audio/mp3'
  if (ext === 'wav')
    return 'audio/wav'

  return 'application/octet-stream'
}

async function handleOpfsMediaRequest(url: URL): Promise<Response> {
  try {
    const cleanPath = url.pathname.replace(/^\/opfs-media\//, '')
    const parts = cleanPath.split('/')
    const root = await navigator.storage.getDirectory()

    let dir = root
    for (let i = 0; i < parts.length - 1; i++) {
      dir = await dir.getDirectoryHandle(parts[i])
    }

    const fileHandle = await dir.getFileHandle(parts[parts.length - 1])
    const file = await fileHandle.getFile()

    const ext = parts[parts.length - 1].split('.').pop()?.toLowerCase() || ''
    const contentType = getMimeTypeFromExt(ext)

    return new Response(file, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    })
  }
  catch {
    return new Response('File not found in OPFS', { status: 404 })
  }
}

// OPFS Media Interceptor (/opfs-media/*)
registerRoute(({ url }) => url.pathname.startsWith('/opfs-media/'), ({ url }) => handleOpfsMediaRequest(url))

if (import.meta.env.PROD) {
  // WEB APP MANIFEST
  registerRoute(({ request, sameOrigin, url }) => {
    if (!url.protocol.startsWith('http'))
      return false

    return sameOrigin && request.destination === 'manifest'
  }, CacheStrategyFactory.createNetworkFirst(CACHE_CONFIG.names.webmanifest, {
    maxEntries: CACHE_CONFIG.limits.manifests,
    maxAgeSeconds: CACHE_CONFIG.durations.manifests,
  }))

  // FONTS
  registerRoute(({ request, url }) => {
    if (!url.protocol.startsWith('http'))
      return false

    return request.destination === 'font'
  }, CacheStrategyFactory.createCacheFirst(CACHE_CONFIG.names.fonts, {
    maxEntries: CACHE_CONFIG.limits.fonts,
    maxAgeSeconds: CACHE_CONFIG.durations.fonts,
    statuses: [0, 200],
  }))
}

// ICONS (Iconify)
registerRoute(({ url }) => url.protocol.startsWith('http') && url.hostname === 'api.iconify.design', CacheStrategyFactory.createStaleWhileRevalidate(CACHE_CONFIG.names.icons, {
  maxEntries: CACHE_CONFIG.limits.icons,
  maxAgeSeconds: CACHE_CONFIG.durations.icons,
}))

// IMAGES
registerRoute(({ request, url }) => {
  if (!url.protocol.startsWith('http'))
    return false

  if (request.destination === 'video' || request.destination === 'audio')
    return false

  return request.destination === 'image' || url.pathname.match(/\.(png|jpg|jpeg|svg|gif|webp)$/i)
}, CacheStrategyFactory.createStaleWhileRevalidate(CACHE_CONFIG.names.images, {
  maxEntries: CACHE_CONFIG.limits.images,
  maxAgeSeconds: CACHE_CONFIG.durations.images,
}))

// --- SPA NAВИГАЦИЯ ---

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
    /^\/docs/,
  ]
}

registerRoute(new NavigationRoute(createHandlerBoundToURL('/'), {
  allowlist,
  denylist,
}))

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
  else if (port) {
    port.postMessage({
      type: 'ERROR',
      payload: { message: `Неизвестный тип сообщения: ${type}` },
    })
  }
})

if (import.meta.env.DEV) {
  console.log('🔧 Service Worker в режиме разработки')
}

self.addEventListener('push', (event: PushEvent) => {
  if (!event.data)
    return

  let title = 'InsightBook'
  let options: any = {
    icon: '/logo.png',
    badge: '/logo.png',
  }

  try {
    const data = event.data.json()
    title = data.title || title
    options = {
      ...options,
      body: data.body,
      icon: data.icon || options.icon,
      badge: data.badge || options.badge,
      vibrate: [200, 100, 200],
      data: {
        url: data.url || '/',
      },
    }
  }
  catch {
    options.body = event.data.text() || 'Новое уведомление'
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close()
  const urlToOpen = event.notification.data?.url || '/'

  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (windowClients) => {
    for (let i = 0; i < windowClients.length; i++) {
      const client = windowClients[i]
      if (client.url.includes(self.location.origin) && 'focus' in client) {
        client.postMessage({ type: 'NAVIGATE', url: urlToOpen })

        return client.focus()
      }
    }

    if (self.clients.openWindow)
      return self.clients.openWindow(urlToOpen)
  }))
})
