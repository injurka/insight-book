import { offlineService } from '~/shared/services/offline.service'
import { useToastStore } from './toast.store'

export const useCacheStore = defineStore('cache', () => {
  const stats = ref<Awaited<ReturnType<typeof offlineService.getCacheStats>> | null>(null)

  const deviceStorage = ref<{ usage: number, quota: number } | null>(null)
  const isPersisted = ref(false)

  const isLoading = ref(false)

  async function loadStats() {
    isLoading.value = true
    try {
      isPersisted.value = await offlineService.requestPersistentStorage()

      deviceStorage.value = await offlineService.getStorageEstimate()

      stats.value = await offlineService.getCacheStats()
    }
    catch {
      useToastStore().error('Ошибка загрузки статистики кэша')
    }
    finally {
      isLoading.value = false
    }
  }

  async function clearBookCache(bookId: number) {
    await offlineService.clearBookCache(bookId)
    useToastStore().success('Кэш книги очищен')
    await loadStats()
  }

  return {
    stats,
    deviceStorage,
    isPersisted,
    isLoading,
    loadStats,
    clearBookCache,
  }
})
