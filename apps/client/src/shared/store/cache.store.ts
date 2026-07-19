import type { defaultRepositories } from '~/shared/plugins/di'
import { useRepos } from '~/shared/plugins/di'
import { useToastStore } from './toast.store'

export const useCacheStore = defineStore('cache', () => {
  const repos = useRepos()
  const stats = ref<Awaited<ReturnType<typeof defaultRepositories.storage.getCacheStats>> | null>(null)

  const deviceStorage = ref<{ usage: number, quota: number } | null>(null)
  const isPersisted = ref(false)

  const isLoading = ref(false)

  async function loadStats() {
    isLoading.value = true
    try {
      isPersisted.value = await repos.storage.requestPersistentStorage()

      deviceStorage.value = await repos.storage.getStorageEstimate()

      stats.value = await repos.storage.getCacheStats()
    }
    catch {
      useToastStore().error('Ошибка загрузки статистики кэша')
    }
    finally {
      isLoading.value = false
    }
  }

  async function clearBookCache(bookId: number) {
    await repos.storage.clearBookCache(bookId)
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
