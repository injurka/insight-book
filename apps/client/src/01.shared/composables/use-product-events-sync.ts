import { onMounted, onUnmounted, watch } from 'vue'
import { useRepos } from '~/00.plugins/di'
import {
  clearProductEventsQueue,
  drainProductEvents,
  onProductEventsBatchReady,
  restoreProductEvents,
} from '~/01.shared/services/product-events.service'
import { useAuthStore } from '~/01.shared/store/auth.store'
import { useNetworkStore } from '~/01.shared/store/network.store'

const FLUSH_INTERVAL_MS = 15_000

export function useProductEventsSync() {
  const { activity } = useRepos()
  const authStore = useAuthStore()
  const networkStore = useNetworkStore()

  let timerId: ReturnType<typeof setInterval> | null = null
  let unsubscribeBatchReady: (() => void) | null = null
  let isFlushing = false

  async function flush(options?: { keepalive?: boolean }): Promise<void> {
    if (isFlushing || !authStore.user || networkStore.effectiveOffline)
      return

    const batch = drainProductEvents()

    if (batch.length === 0)
      return

    isFlushing = true

    try {
      await activity.sendEvents(batch, { keepalive: options?.keepalive })
    }
    catch {
      if (!options?.keepalive)
        restoreProductEvents(batch)
    }
    finally {
      isFlushing = false
    }
  }

  function onVisibilityChange(): void {
    if (document.visibilityState === 'hidden')
      void flush({ keepalive: true })
  }

  function onPageHide(): void {
    void flush({ keepalive: true })
  }

  watch(() => authStore.user, (user, prevUser) => {
    if (user) {
      void flush()
    }
    else if (prevUser) {
      clearProductEventsQueue()
    }
  })

  onMounted(() => {
    void flush()

    unsubscribeBatchReady = onProductEventsBatchReady(() => {
      void flush()
    })

    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('pagehide', onPageHide)

    timerId = setInterval(() => {
      void flush()
    }, FLUSH_INTERVAL_MS)
  })

  onUnmounted(() => {
    void flush({ keepalive: true })

    if (timerId !== null) {
      clearInterval(timerId)
      timerId = null
    }

    unsubscribeBatchReady?.()
    unsubscribeBatchReady = null

    document.removeEventListener('visibilitychange', onVisibilityChange)
    window.removeEventListener('pagehide', onPageHide)
  })
}
