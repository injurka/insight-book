import { beforeEach, describe, expect, it, vi } from 'vitest'
import { UserDictItemSchema } from '../types/schemas/dictionary.schema'
import { DefaultDictionaryRepository } from './dictionary.repository'

const mocks = vi.hoisted(() => ({ get: vi.fn(), getDictionaryWord: vi.fn(), saveDictionaryWord: vi.fn() }))
vi.mock('~/01.shared/services/api.service', () => ({ api: { dictionary: { get: mocks.get } } }))
vi.mock('~/01.shared/services/offline.service', () => ({ offlineService: mocks }))
vi.mock('~/01.shared/store/auth.store', () => ({ useAuthStore: () => ({ user: { id: 1 }, isSingleMode: false }) }))
vi.mock('~/01.shared/store/settings.store', () => ({ useGlobalSettingsStore: () => ({ appLanguage: 'ru' }) }))
const card = UserDictItemSchema.parse({
  id: 1,
  word: 'gift',
  language: 'en',
  due: '2030-01-01',
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
})

describe('dictionary repository offline links', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mocks.getDictionaryWord.mockResolvedValue(card)
  })

  it('uses individual offline cache for legacy links without source language', async () => {
    mocks.get.mockRejectedValue(new TypeError('Failed to fetch'))
    expect(await new DefaultDictionaryRepository().get('gift')).toEqual(card)
    expect(mocks.getDictionaryWord).toHaveBeenCalledWith('gift', undefined)
  })

  it('does not hide ambiguous or unauthorized server responses with cached entries', async () => {
    for (const status of [401, 404, 409]) {
      const error = Object.assign(new Error('Server rejected lookup'), { status })
      mocks.get.mockRejectedValue(error)
      await expect(new DefaultDictionaryRepository().get('gift')).rejects.toBe(error)
    }

    expect(mocks.getDictionaryWord).not.toHaveBeenCalled()
  })
})
