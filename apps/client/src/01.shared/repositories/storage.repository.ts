import { applyAcl } from '~/01.shared/lib/acl'
import { offlineService } from '~/01.shared/services/offline.service'
import { StorageEstimateSchema } from '~/01.shared/types/schemas/storage.schema'

export interface IStorageRepository {
  getStorageEstimate: () => Promise<{ usage: number, quota: number } | null>
  requestPersistentStorage: () => Promise<boolean>
  getCacheStats: () => Promise<Awaited<ReturnType<typeof offlineService.getCacheStats>>>
  clearBookCache: (bookId: number) => Promise<void>
}

export class DefaultStorageRepository implements IStorageRepository {
  async getStorageEstimate() {
    const raw = await offlineService.getStorageEstimate()
    if (!raw)
      return raw
    return applyAcl(StorageEstimateSchema, raw, 'storage.getStorageEstimate()')
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
