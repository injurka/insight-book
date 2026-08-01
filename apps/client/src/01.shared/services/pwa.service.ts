/* eslint-disable no-console */
import type { Pinia } from 'pinia'
import { useRegisterSW } from 'virtual:pwa-register/vue'
import { watch } from 'vue'
import router from '~/01.shared/lib/router'
import { usePwaStore } from '~/01.shared/store/pwa.store'

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
    onRegistered(registration) {
      if (registration) {
        setInterval(async () => {
          try {
            if (registration.installing || !navigator.onLine)
              return

            await registration.update()
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

  watch(() => offlineReady.value, (value) => {
    console.log(`App ready to work offline: ${value}`)
    pwaStore.setOfflineReady(value)
  }, { immediate: true })

  watch(() => needRefresh.value, (value) => {
    console.log(`New content available, show refresh prompt: ${value}`)
    pwaStore.setNeedRefresh(value)
  }, { immediate: true })

  pwaStore.setUpdateFunction(updateServiceWorker)

  // Перехватываем сообщение от ServiceWorker при клике на Push
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', async (event) => {
      if (event.data && event.data.type === 'NAVIGATE' && event.data.url) {
        try {
          const { useAnalysisStore } = await import('~/01.shared/store/analysis/analysis.store')
          const analysisStore = useAnalysisStore(pinia)
          analysisStore.isPageAnalysisModalOpen = false
          analysisStore.addEditWordModalOpen = false
        }
        catch (e) {
          console.warn('Failed to close global modals before navigation:', e)
        }
        router.push(event.data.url)
      }
    })
  }
}

export { initializePwaUpdater }
