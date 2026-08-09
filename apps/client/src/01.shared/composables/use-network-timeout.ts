import { storeToRefs } from 'pinia'
import { onUnmounted, ref } from 'vue'
import { useNetworkStore } from '../store/network.store'

export interface UseNetworkTimeoutOptions {
  timeoutMs?: number
  autoAbortOnOffline?: boolean
}

/**
 * Composable для оборачивания долгих асинхронных операций (например, загрузка книги/главы).
 * Если операция превышает timeoutMs (по умолчанию 5 секунд), вызывается оверлей выбора:
 * - Продолжить повторным запросом
 * - Перейти в оффлайн-режим (с отменяющим AbortController)
 */
export function useNetworkTimeout(options: UseNetworkTimeoutOptions = {}) {
  const { timeoutMs = 5000 } = options
  const networkStore = useNetworkStore()
  const { isTimeoutModalOpen, effectiveOffline } = storeToRefs(networkStore)

  const currentController = ref<AbortController | null>(null)

  /**
   * Выполняет асинхронную функцию под контролем таймера и AbortController
   */
  async function runWithTimeout<T>(fn: (signal: AbortSignal) => Promise<T>): Promise<T> {
    if (networkStore.effectiveOffline) {
      // Если уже в forced offline режиме, выполняем без ожидания или вызываем с отмененным сигналом
      const controller = new AbortController()
      controller.abort('App in offline mode')

      return fn(controller.signal)
    }

    const controller = new AbortController()
    currentController.value = controller
    networkStore.registerController(controller)
    networkStore.startLoadingTimer(timeoutMs)

    try {
      const result = await fn(controller.signal)
      networkStore.stopLoadingTimer()

      return result
    }
    catch (error) {
      networkStore.stopLoadingTimer()
      throw error
    }
    finally {
      networkStore.unregisterController(controller)
      if (currentController.value === controller) {
        currentController.value = null
      }
    }
  }

  onUnmounted(() => {
    if (currentController.value) {
      networkStore.unregisterController(currentController.value)
    }
  })

  return {
    runWithTimeout,
    isTimeoutModalOpen,
    effectiveOffline,
    enterOfflineMode: () => networkStore.enterOfflineMode(),
    retryRequest: () => networkStore.retryRequest(timeoutMs),
  }
}
