import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DefaultStorageRepository } from './storage.repository'

const mocks = vi.hoisted(() => ({
  getStorageEstimate: vi.fn(),
  requestPersistentStorage: vi.fn(),
  getCacheStats: vi.fn(),
  clearBookCache: vi.fn(),
}))

vi.mock('~/01.shared/services/offline.service', () => ({
  offlineService: mocks,
}))

describe('storage repository', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns null when storage estimate is unavailable and validates estimate via ACL otherwise', async () => {
    const repo = new DefaultStorageRepository()

    mocks.getStorageEstimate.mockResolvedValueOnce(null)
    await expect(repo.getStorageEstimate()).resolves.toBeNull()

    mocks.getStorageEstimate.mockResolvedValueOnce({ usage: 1024, quota: 8192 })
    await expect(repo.getStorageEstimate()).resolves.toEqual({ usage: 1024, quota: 8192 })
  })

  it('delegates requestPersistentStorage, getCacheStats, and clearBookCache', async () => {
    mocks.requestPersistentStorage.mockResolvedValue(true)
    const stats = {
      totalBooks: 2,
      totalPages: 40,
      totalImages: 10,
      totalTts: 5,
      totalDictionaryWords: 120,
      books: [],
    }
    mocks.getCacheStats.mockResolvedValue(stats)
    mocks.clearBookCache.mockResolvedValue(undefined)

    const repo = new DefaultStorageRepository()

    await expect(repo.requestPersistentStorage()).resolves.toBe(true)
    await expect(repo.getCacheStats()).resolves.toEqual(stats)
    await repo.clearBookCache(42)

    expect(mocks.clearBookCache).toHaveBeenCalledWith(42)
  })
})
