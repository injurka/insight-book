import type { MessageHandlers } from '../model/types'
import { getCacheInfo } from './utils'

declare let self: ServiceWorkerGlobalScope

const messageHandlers: MessageHandlers = {
  async SKIP_WAITING() {
    await self.skipWaiting()
  },

  async GET_CACHE_INFO(port) {
    try {
      const info = await getCacheInfo()
      port.postMessage({ type: 'CACHE_INFO', payload: info })
    }
    catch {
      port.postMessage({
        type: 'ERROR',
        payload: { message: 'Не удалось получить информацию о кеше' },
      })
    }
  },

  async CLEAR_CACHE(port, payload) {
    if (!payload?.cacheName) {
      port.postMessage({
        type: 'ERROR',
        payload: { message: 'Не указано имя кеша' },
      })
      return
    }

    try {
      const deleted = await caches.delete(payload.cacheName)
      port.postMessage({
        type: 'CACHE_CLEARED',
        payload: { success: deleted, cacheName: payload.cacheName },
      })
    }
    catch {
      port.postMessage({
        type: 'ERROR',
        payload: { message: 'Ошибка при удалении кеша' },
      })
    }
  },
}

export { messageHandlers }
