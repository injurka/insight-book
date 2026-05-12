import { defineStore } from 'pinia'
import { ref } from 'vue'
import { offlineService } from '~/shared/services/offline.service'
import { useToastStore } from './toast.store'

export const useCacheStore = defineStore('cache', () => {
  const stats = ref<Awaited<ReturnType<typeof offlineService.getCacheStats>> | null>(null)

  // Системная квота браузера
  const deviceStorage = ref<{ usage: number, quota: number } | null>(null)
  const isPersisted = ref(false)

  const isLoading = ref(false)

  async function loadStats() {
    isLoading.value = true
    try {
      // Пытаемся запросить надежное хранилище при первом входе в настройки
      isPersisted.value = await offlineService.requestPersistentStorage()

      // Запрашиваем квоту диска
      deviceStorage.value = await offlineService.getStorageEstimate()

      // Собираем нашу внутреннюю статистику
      stats.value = await offlineService.getCacheStats()
    }
    catch (e: any) {
      useToastStore().error('Ошибка загрузки статистики кэша')
    }
    finally {
      isLoading.value = false
    }
  }

  async function clearBookCache(bookId: number) {
    await offlineService.clearBookCache(bookId)
    useToastStore().success('Кэш книги очищен')
    await loadStats() // Обновляем стату после удаления
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
