/* eslint-disable no-console */
import type { Pinia } from 'pinia'
import { useRegisterSW } from 'virtual:pwa-register/vue'
import router from '~/shared/lib/router'
import { usePwaStore } from '~/shared/store/pwa.store'

/**
 * Инициализирует PWA и периодическую проверку обновлений.
 */
function initializePwaUpdater(pinia: Pinia): void {
  const pwaStore = usePwaStore(pinia)
  const intervalMS = 60 * 1 * 1000 * 10

  const {
    offlineReady,
    needRefresh,
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      if (r) {
        setInterval(async () => {
          try {
            if (r.installing || !navigator.onLine)
              return

            await r.update()
          }
          catch (error) {
            console.warn('SW update check failed:', error)
          }
        }, intervalMS)
      }
    },
    onRegisterError(error) {
      console.error('Error during Service Worker registration:', error)
    },
  })

  watch(offlineReady, (value) => {
    console.log(`App ready to work offline: ${value}`)
    pwaStore.setOfflineReady(value)
  }, { immediate: true })

  watch(needRefresh, (value) => {
    console.log(`New content available, show refresh prompt: ${value}`)
    pwaStore.setNeedRefresh(value)
  }, { immediate: true })

  pwaStore.setUpdateFunction(updateServiceWorker)

  // Перехватываем сообщение от ServiceWorker при клике на Push
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data && event.data.type === 'NAVIGATE' && event.data.url) {
        router.push(event.data.url)
      }
    })
  }
}

export { initializePwaUpdater }
