/// <reference lib="WebWorker" />
/// <reference types="vite/client" />
/// <reference types="@types/workbox-sw" />

type AssetType = 'hashed' | 'vendor' | 'regular'

interface ServiceWorkerMessage {
  type: 'SKIP_WAITING' | 'GET_CACHE_INFO' | 'CLEAR_CACHE'
  payload?: {
    cacheName?: string
  }
}

interface CacheInfo {
  name: string
  size: number
  urls: string[]
  totalSize?: number
}

const CACHE_CONFIG = {
  names: {
    webmanifest: 'insight-book-pwa-webmanifest',
    fonts: 'insight-book-fonts',
    images: 'insight-book-images',
    icons: 'insight-book-icons',
    hashedAssets: 'insight-book-hashed-assets',
    vendorAssets: 'insight-book-vendor-assets',
    regularAssets: 'insight-book-regular-assets',
    content: 'insight-book-content',
  },
  durations: {
    images: 365 * 24 * 60 * 60,
    fonts: 365 * 24 * 60 * 60,
    icons: 30 * 24 * 60 * 60,
    content: 7 * 24 * 60 * 60,
    static: {
      hashed: 365 * 24 * 60 * 60,
      vendor: 30 * 24 * 60 * 60,
      regular: 2 * 60 * 60,
    },
    manifests: 7 * 24 * 60 * 60,
  },
  limits: {
    fonts: 800,
    images: 1000,
    icons: 500,
    content: 1000,
    hashedAssets: 200,
    vendorAssets: 100,
    regularAssets: 50,
    manifests: 100,
  },
} as const

interface MessageHandlers {
  SKIP_WAITING: () => Promise<void>
  GET_CACHE_INFO: (port: MessagePort) => Promise<void>
  CLEAR_CACHE: (port: MessagePort, payload?: { cacheName?: string }) => Promise<void>
}

export {
  type AssetType,
  CACHE_CONFIG,
  type CacheInfo,
  type MessageHandlers,
  type ServiceWorkerMessage,
}
