import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DefaultPushRepository } from './push.repository'

const mocks = vi.hoisted(() => ({
  subscribe: vi.fn(),
  unsubscribe: vi.fn(),
  getVapidPublicKey: vi.fn(),
  updateSettings: vi.fn(),
}))

vi.mock('~/01.shared/services/api.service', () => ({
  api: { push: mocks },
}))

describe('push repository', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('delegates web push subscription, unsubscription, and settings update', async () => {
    mocks.subscribe.mockResolvedValue(undefined)
    mocks.unsubscribe.mockResolvedValue(undefined)
    mocks.updateSettings.mockResolvedValue(undefined)

    const subscription = { endpoint: 'https://push.example.test/sub/1' } as PushSubscription
    const settings = {
      targetDeckId: 'all' as const,
      timeStart: '09:00',
      timeEnd: '21:00',
      timezone: 'UTC',
      uiLanguage: 'ru',
      pushCount: 3,
    }

    const repo = new DefaultPushRepository()
    await repo.subscribeWeb(subscription)
    await repo.unsubscribeWeb(subscription.endpoint)
    await repo.updateSettings(settings)

    expect(mocks.subscribe).toHaveBeenCalledWith(subscription)
    expect(mocks.unsubscribe).toHaveBeenCalledWith(subscription.endpoint)
    expect(mocks.updateSettings).toHaveBeenCalledWith(settings)
  })

  it('extracts and validates VAPID public key via ACL', async () => {
    mocks.getVapidPublicKey.mockResolvedValue({ publicKey: 'BEl62iUYgUivxIkv69yViEuiBIa' })

    const repo = new DefaultPushRepository()
    await expect(repo.getVapidPublicKey()).resolves.toBe('BEl62iUYgUivxIkv69yViEuiBIa')
  })

  it('throws ACL error when VAPID public key response is invalid', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.getVapidPublicKey.mockResolvedValue({ publicKey: 123 })

    const repo = new DefaultPushRepository()
    await expect(repo.getVapidPublicKey()).rejects.toThrow('[ACL Error] Contract mismatch in push.getVapidPublicKey()')
    consoleSpy.mockRestore()
  })
})
