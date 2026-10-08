import type { Component } from 'vue'
import { defineAsyncComponent } from 'vue'
import { useToastStore } from '~/01.shared/store/toast.store'

interface LazyComponentOptions {
  loadingComponent?: Component
  delay?: number
  timeout?: number
}

const CHUNK_RELOAD_WINDOW_MS = 60_000

function tryReloadChunk(): boolean {
  try {
    const storedCount = Number(sessionStorage.getItem('chunk_reload_count') || '0')
    const lastReload = Number(sessionStorage.getItem('chunk_reload_time') || '0')
    const withinWindow = Date.now() - lastReload < CHUNK_RELOAD_WINDOW_MS
    const reloadCount = withinWindow && Number.isFinite(storedCount) && storedCount >= 0 ? storedCount : 0

    if (reloadCount >= 2)
      return false

    sessionStorage.setItem('chunk_reload_count', String(reloadCount + 1))
    sessionStorage.setItem('chunk_reload_time', String(Date.now()))
    window.location.reload()

    return true
  }
  catch {
    // Storage or reload can be unavailable in a restricted browser.
    return false
  }
}

/**
 * Умная обертка для ленивой загрузки компонентов.
 * Обрабатывает ошибки сети, ошибки версионирования чанков и показывает лоадер.
 */
export function lazyComponent(loader: () => Promise<Component>, options: LazyComponentOptions = {}) {
  const { loadingComponent, delay = 300, timeout = 10000 } = options

  return defineAsyncComponent({
    loader,

    // The caller supplies UI from its own layer.
    loadingComponent,

    delay,
    timeout,

    onError(
      error,
      retry,
      fail,
      attempts,
    ) {
      const errorMessage = error.message.toLowerCase()
      const isChunkLoadError = errorMessage.includes('fetch dynamically imported module')
        || errorMessage.includes('importing a module script failed')

      if (isChunkLoadError && tryReloadChunk())
        return

      // Для других сетевых ошибок — делаем до 3 попыток перезапроса
      if (attempts <= 3) {
        setTimeout(retry, 1000)
      }

      // Ждем 1 секунду перед новой попыткой
      else {
        const toast = useToastStore()
        toast.error('Ошибка загрузки компонента. Проверьте интернет-соединение.')
        fail()
      }
    },
  })
}
