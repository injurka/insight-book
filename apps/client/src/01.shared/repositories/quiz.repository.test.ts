import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DefaultQuizRepository } from './quiz.repository'

const mocks = vi.hoisted(() => ({
  getLevels: vi.fn(),
  generate: vi.fn(),
  submit: vi.fn(),
}))

vi.mock('~/01.shared/services/api.service', () => ({
  api: { quiz: mocks },
}))

describe('quiz repository', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('fetches and validates quiz levels with ACL', async () => {
    mocks.getLevels.mockResolvedValue([
      {
        id: 1,
        language: 'zh',
        levelValue: 'HSK1',
        bestScore: 85,
        stars: 2,
        unlocked: true,
      },
    ])

    const repo = new DefaultQuizRepository()
    const levels = await repo.getLevels('zh')

    expect(mocks.getLevels).toHaveBeenCalledWith('zh')
    expect(levels).toEqual([
      {
        id: 1,
        language: 'zh',
        levelValue: 'HSK1',
        bestScore: 85,
        stars: 2,
        unlocked: true,
      },
    ])
  })

  it('generates and validates quiz questions with ACL fallbacks', async () => {
    mocks.generate.mockResolvedValue({
      questions: [
        {
          type: 'unknown-type',
          question: 'Choose the right word',
          options: ['A', 'B'],
          correctAnswer: 'A',
          explanation: 'Because A is right',
        },
      ],
      cached: 'bad-bool',
    })

    const repo = new DefaultQuizRepository()
    const response = await repo.generate('en', 'B1')

    expect(mocks.generate).toHaveBeenCalledWith('en', 'B1')
    expect(response).toEqual({
      questions: [
        {
          type: 'choice',
          question: 'Choose the right word',
          options: ['A', 'B'],
          correctAnswer: 'A',
          explanation: 'Because A is right',
        },
      ],
      cached: false,
    })
  })

  it('submits quiz results directly through api.quiz.submit', async () => {
    const submitResult = {
      success: true,
      score: 95,
      starsEarned: 3,
      isPassed: true,
      nextLevelUnlocked: true,
      nextLevelValue: 'B2',
    }
    mocks.submit.mockResolvedValue(submitResult)

    const repo = new DefaultQuizRepository()
    await expect(repo.submit('en', 'B1', 95)).resolves.toEqual(submitResult)
    expect(mocks.submit).toHaveBeenCalledWith('en', 'B1', 95)
  })
})
