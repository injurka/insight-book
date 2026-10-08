import { storeToRefs } from 'pinia'
import { onScopeDispose, watch } from 'vue'
import { useNetworkStore } from '../store/network.store'

export interface UseNetworkTimeoutOptions {
  timeoutMs?: number
  autoAbortOnOffline?: boolean
}

interface PendingOperation {
  retry: () => void
}

// The timeout dialog belongs to the store, so its lifetime must cover all callers.
const operationsByStore = new WeakMap<ReturnType<typeof useNetworkStore>, Set<PendingOperation>>()

function withAbort<T>(fn: (signal: AbortSignal) => Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const abort = () => reject(new DOMException(String(signal.reason ?? 'Aborted'), 'AbortError'))

    if (signal.aborted) {
      abort()

      return
    }

    signal.addEventListener('abort', abort, { once: true })
    Promise.resolve().then(() => {
      signal.throwIfAborted()

      return fn(signal)
    }).then(resolve, reject).finally(() => {
      signal.removeEventListener('abort', abort)
    })
  })
}

/** Runs cancellable operations under the shared network timeout dialog. */
export function useNetworkTimeout(options: UseNetworkTimeoutOptions = {}) {
  const { timeoutMs = 5000, autoAbortOnOffline = true } = options
  const networkStore = useNetworkStore()
  const { isTimeoutModalOpen, effectiveOffline } = storeToRefs(networkStore)
  const controllers = new Set<AbortController>()
  let disposed = false
  const operations = operationsByStore.get(networkStore) ?? new Set<PendingOperation>()
  operationsByStore.set(networkStore, operations)

  function registerController(controller: AbortController) {
    controllers.add(controller)

    if (autoAbortOnOffline)
      networkStore.registerController(controller)
  }

  async function runWithTimeout<T>(fn: (signal: AbortSignal) => Promise<T>): Promise<T> {
    if (disposed)
      throw new DOMException('Scope disposed', 'AbortError')

    if (networkStore.effectiveOffline) {
      const controller = new AbortController()
      controller.abort('App in offline mode')

      return fn(controller.signal)
    }

    let retryRequested = false
    let controller: AbortController | null = null
    const operation: PendingOperation = {
      retry() {
        retryRequested = true
        controller?.abort('Retry requested')
      },
    }
    operations.add(operation)
    networkStore.setRetryHandler(() => {
      operations.forEach(pending => pending.retry())
    })

    if (operations.size === 1)
      networkStore.startLoadingTimer(timeoutMs)

    try {
      while (true) {
        retryRequested = false
        controller = new AbortController()
        registerController(controller)

        try {
          return await withAbort(fn, controller.signal)
        }
        catch (error) {
          if (!retryRequested || disposed || networkStore.effectiveOffline)
            throw error

          networkStore.startLoadingTimer(timeoutMs)
        }
        finally {
          networkStore.unregisterController(controller)
          controllers.delete(controller)
        }
      }
    }
    finally {
      operations.delete(operation)

      if (operations.size === 0) {
        networkStore.stopLoadingTimer()
        networkStore.setRetryHandler(null)
      }
    }
  }

  watch(effectiveOffline, (offline) => {
    if (offline && autoAbortOnOffline)
      controllers.forEach(controller => controller.abort('App in offline mode'))
  }, { flush: 'sync' })

  onScopeDispose(() => {
    disposed = true
    controllers.forEach((controller) => {
      controller.abort('Scope disposed')
      networkStore.unregisterController(controller)
    })
  })

  return {
    runWithTimeout,
    isTimeoutModalOpen,
    effectiveOffline,
    enterOfflineMode: () => networkStore.enterOfflineMode(),
    retryRequest: () => networkStore.retryRequest(timeoutMs),
  }
}
