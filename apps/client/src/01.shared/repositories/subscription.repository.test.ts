import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DefaultSubscriptionRepository } from './subscription.repository'

const mocks = vi.hoisted(() => ({
  getTiers: vi.fn(),
}))

vi.mock('~/01.shared/services/api.service', () => ({
  api: { subscriptions: mocks },
}))

describe('subscription repository', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('fetches and validates subscription tiers with ACL defaults', async () => {
    mocks.getTiers.mockResolvedValue([
      {
        id: 'pro',
        name: 'Pro',
        price: 499,
        features: ['Unlimited books'],
        isPopular: true,
      },
    ])

    const repo = new DefaultSubscriptionRepository()
    const tiers = await repo.getTiers('ru')

    expect(mocks.getTiers).toHaveBeenCalledWith('ru')
    expect(tiers).toEqual([
      {
        id: 'pro',
        icon: 'mdi:star',
        badge: '',
        name: 'Pro',
        price: 499,
        dailyTokenLimit: null,
        dailyBookLimit: null,
        description: '',
        features: ['Unlimited books'],
        isPopular: true,
        gradient: '',
        accentColor: '#94a3b8',
      },
    ])
  })

  it('throws ACL error when tier payload is invalid', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.getTiers.mockResolvedValue([{ name: 'Missing id' }])

    const repo = new DefaultSubscriptionRepository()
    await expect(repo.getTiers('en')).rejects.toThrow('[ACL Error] Contract mismatch in subscription.getTiers(en)')
    consoleSpy.mockRestore()
  })
})
