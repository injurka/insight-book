type UpdateServiceWorkerFunction = (reloadPage?: boolean) => Promise<void>

export interface PwaState {
  offlineReady: boolean
  needRefresh: boolean
  updateServiceWorker: UpdateServiceWorkerFunction | null
}

export const usePwaStore = defineStore('pwa', {
  state: (): PwaState => ({
    offlineReady: false,
    needRefresh: false,
    updateServiceWorker: null,
  }),

  actions: {
    setOfflineReady(value: boolean) {
      this.offlineReady = value
    },

    setNeedRefresh(value: boolean) {
      this.needRefresh = value
    },

    setUpdateFunction(updateFn: UpdateServiceWorkerFunction) {
      this.updateServiceWorker = updateFn
    },

    async triggerUpdate() {
      if (this.updateServiceWorker) {
        await this.updateServiceWorker(true)
      }
      this.needRefresh = false
    },

    closePrompt() {
      this.offlineReady = false
      this.needRefresh = false
    },
  },
})
