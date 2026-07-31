import { offlineService } from '~/01.shared/services/offline.service'

export interface IStorageRepository {
  getStorageEstimate: () => Promise<{ usage: number, quota: number } | null>
  requestPersistentStorage: () => Promise<boolean>
  getCacheStats: () => Promise<Awaited<ReturnType<typeof offlineService.getCacheStats>>>
  clearBookCache: (bookId: number) => Promise<void>
}

export class DefaultStorageRepository implements IStorageRepository {
  async getStorageEstimate() {
    return await offlineService.getStorageEstimate()
  }

  async requestPersistentStorage() {
    return await offlineService.requestPersistentStorage()
  }

  async getCacheStats() {
    return await offlineService.getCacheStats()
  }

  async clearBookCache(bookId: number) {
    await offlineService.clearBookCache(bookId)
  }
}

export const storageRepository: IStorageRepository = new DefaultStorageRepository()
