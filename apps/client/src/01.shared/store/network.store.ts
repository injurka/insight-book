export interface NetworkState {
  isOnline: boolean
  isForcedOffline: boolean
  isTimeoutModalOpen: boolean
  isRequestPending: boolean
  pendingControllers: Set<AbortController>
  timeoutId: ReturnType<typeof setTimeout> | null
  retryHandler: (() => void) | null
}

export const useNetworkStore = defineStore('network', {
  state: (): NetworkState => ({
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    isForcedOffline: false,
    isTimeoutModalOpen: false,
    isRequestPending: false,
    pendingControllers: new Set<AbortController>(),
    timeoutId: null,
    retryHandler: null,
  }),

  getters: {
    effectiveOffline(state): boolean {
      return !state.isOnline || state.isForcedOffline
    },
  },

  actions: {
    initListeners() {
      if (typeof window === 'undefined')
        return

      window.addEventListener('online', () => {
        this.isOnline = true
      })

      window.addEventListener('offline', () => {
        this.isOnline = false
      })
    },

    registerController(controller: AbortController) {
      this.pendingControllers.add(controller)
    },

    unregisterController(controller: AbortController) {
      this.pendingControllers.delete(controller)
    },

    startLoadingTimer(durationMs = 5000) {
      this.clearLoadingTimer()
      this.isRequestPending = true

      this.timeoutId = setTimeout(() => {
        if (this.isRequestPending && !this.isForcedOffline) {
          this.isTimeoutModalOpen = true
        }
      }, durationMs)
    },

    stopLoadingTimer() {
      this.isRequestPending = false
      this.clearLoadingTimer()
      this.isTimeoutModalOpen = false
    },

    clearLoadingTimer() {
      if (this.timeoutId) {
        clearTimeout(this.timeoutId)
        this.timeoutId = null
      }
    },

    retryRequest(durationMs = 5000) {
      this.isTimeoutModalOpen = false
      this.retryHandler?.()
      if (!this.retryHandler)
        this.startLoadingTimer(durationMs)
    },

    setRetryHandler(handler: (() => void) | null) {
      this.retryHandler = handler
    },

    enterOfflineMode() {
      this.isForcedOffline = true
      this.isTimeoutModalOpen = false
      this.clearLoadingTimer()
      this.abortAllPendingRequests()
    },

    exitOfflineMode() {
      this.isForcedOffline = false
    },

    abortAllPendingRequests() {
      this.pendingControllers.forEach((controller) => {
        try {
          controller.abort('Switching to offline mode due to timeout')
        }
        catch { }
      })
      this.pendingControllers.clear()
      this.isRequestPending = false
    },
  },
})
