import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DefaultActivityRepository } from './activity.repository'

const mocks = vi.hoisted(() => ({
  getStats: vi.fn(),
  getTokens: vi.fn(),
}))

vi.mock('~/01.shared/services/api.service', () => ({
  api: { activity: mocks },
}))

describe('activity repository', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('fetches and validates activity stats with ACL defaults', async () => {
    mocks.getStats.mockResolvedValue({
      heatmap: [{ date: '2026-11-20', count: 4 }],
      learnedWords: 12,
      readPages: 5,
      difficulties: [{ language: 'en', difficulty: 'B1', count: 3 }],
      quizProgress: [{
        language: 'en',
        levelValue: 'B1',
        bestScore: 90,
        stars: 3,
        unlocked: 'invalid',
      }],
    })

    const repo = new DefaultActivityRepository()
    const stats = await repo.getStats()

    expect(mocks.getStats).toHaveBeenCalledOnce()
    expect(stats).toEqual({
      heatmap: [{ date: '2026-11-20', count: 4 }],
      learnedWords: 12,
      readPages: 5,
      difficulties: [{ language: 'en', difficulty: 'B1', count: 3 }],
      quizProgress: [{
        language: 'en',
        levelValue: 'B1',
        bestScore: 90,
        stars: 3,
        unlocked: false,
      }],
    })
  })

  it('throws ACL error when stats payload is invalid', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.getStats.mockResolvedValue({ heatmap: [{ date: 123 }] })

    const repo = new DefaultActivityRepository()

    await expect(repo.getStats()).rejects.toThrow('[ACL Error] Contract mismatch in activity.getStats()')
    consoleSpy.mockRestore()
  })

  it('fetches and validates token usage for a period', async () => {
    mocks.getTokens.mockResolvedValue({
      stats: [{ action: 'analyze', inputTokens: 100, outputTokens: 50, cost: 0.01 }],
      daily: [{ date: '2026-11-20', inputTokens: 100, outputTokens: 50 }],
      totalCost: 0.01,
    })

    const repo = new DefaultActivityRepository()
    const tokens = await repo.getTokens('30d')

    expect(mocks.getTokens).toHaveBeenCalledWith('30d')
    expect(tokens).toEqual({
      stats: [{ action: 'analyze', inputTokens: 100, outputTokens: 50, cost: 0.01 }],
      daily: [{ date: '2026-11-20', inputTokens: 100, outputTokens: 50 }],
      totalCost: 0.01,
    })
  })

  it('throws ACL error when tokens payload is invalid', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.getTokens.mockResolvedValue({ totalCost: 'not-a-number' })

    const repo = new DefaultActivityRepository()

    await expect(repo.getTokens('7d')).rejects.toThrow('[ACL Error] Contract mismatch in activity.getTokens()')
    consoleSpy.mockRestore()
  })
})
