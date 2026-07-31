import type { UserDictItem } from '~/01.shared/types/models'
import { describe, expect, it } from 'vitest'
import { CardState, Flashcard } from './flashcard.entity'

const NOW = new Date('2026-07-28T12:00:00.000Z')
const DAY_MS = 24 * 60 * 60 * 1000

function createFlashcard(overrides: Partial<UserDictItem> = {}): Flashcard {
  return new Flashcard({
    id: 1,
    deckIds: [1],
    word: 'serendipity',
    transcription: null,
    translation: 'счастливая находка',
    language: 'en',
    targetLanguage: 'ru',
    notes: null,
    tags: null,
    difficulty: null,
    grammarNote: null,
    vocabularyNote: null,
    state: CardState.Review,
    due: new Date(NOW.getTime() - DAY_MS).toISOString(), // due yesterday
    stability: 10,
    difficultyFsrs: 5,
    scheduledDays: 10,
    reps: 5,
    lapses: 1,
    lastReview: new Date(NOW.getTime() - 10 * DAY_MS).toISOString(),
    learningSteps: 0,
    createdAt: new Date(NOW.getTime() - 30 * DAY_MS).toISOString(),
    updatedAt: new Date(NOW.getTime() - 10 * DAY_MS).toISOString(),
    ...overrides,
  } as UserDictItem)
}

describe('flashcard entity', () => {
  describe('state helpers', () => {
    it('isNew returns true only for New state', () => {
      expect(createFlashcard({ state: CardState.New }).isNew()).toBe(true)
      expect(createFlashcard({ state: CardState.Learning }).isNew()).toBe(false)
      expect(createFlashcard({ state: CardState.Review }).isNew()).toBe(false)
      expect(createFlashcard({ state: CardState.Relearning }).isNew()).toBe(false)
    })

    it('isLearning returns true for Learning and Relearning states', () => {
      expect(createFlashcard({ state: CardState.New }).isLearning()).toBe(false)
      expect(createFlashcard({ state: CardState.Learning }).isLearning()).toBe(true)
      expect(createFlashcard({ state: CardState.Review }).isLearning()).toBe(false)
      expect(createFlashcard({ state: CardState.Relearning }).isLearning()).toBe(true)
    })

    it('isReview returns true only for Review state', () => {
      expect(createFlashcard({ state: CardState.New }).isReview()).toBe(false)
      expect(createFlashcard({ state: CardState.Learning }).isReview()).toBe(false)
      expect(createFlashcard({ state: CardState.Review }).isReview()).toBe(true)
      expect(createFlashcard({ state: CardState.Relearning }).isReview()).toBe(false)
    })
  })

  describe('calculateNextReviewIntervals', () => {
    it('returns again/hard/good/easy keys for a Review card with due in the past', () => {
      const intervals = createFlashcard().calculateNextReviewIntervals(NOW)

      expect(Object.keys(intervals).sort()).toEqual(['again', 'easy', 'good', 'hard'])
      expect(intervals).toEqual({
        again: '10 м',
        hard: '23 дн',
        good: '1 мес',
        easy: '2 мес',
      })
    })

    it('returns the same intervals for a Review card with due in the future', () => {
      const card = createFlashcard({
        due: new Date(NOW.getTime() + DAY_MS).toISOString(),
      })

      expect(card.calculateNextReviewIntervals(NOW)).toEqual({
        again: '10 м',
        hard: '23 дн',
        good: '1 мес',
        easy: '2 мес',
      })
    })

    it('returns minute-based intervals for a New card', () => {
      const card = createFlashcard({
        state: CardState.New,
        due: NOW.toISOString(),
        stability: 0,
        difficultyFsrs: 0,
        scheduledDays: 0,
        reps: 0,
        lapses: 0,
        lastReview: null,
      })

      const intervals = card.calculateNextReviewIntervals(NOW)

      expect(intervals.again).toMatch(/^\d+ м$/)
      expect(intervals.hard).toMatch(/^\d+ м$/)
      expect(intervals.good).toMatch(/^\d+ м$/)
      expect(intervals.easy).toMatch(/^\d+ дн$/)
      expect(intervals).toEqual({
        again: '1 м',
        hard: '6 м',
        good: '10 м',
        easy: '8 дн',
      })
    })

    it('returns minute-based short intervals for a Learning card', () => {
      const card = createFlashcard({ state: CardState.Learning })

      const intervals = card.calculateNextReviewIntervals(NOW)

      expect(intervals).toEqual({
        again: '1 м',
        hard: '6 м',
        good: '10 м',
        easy: '2 мес',
      })
    })

    it('returns minute-based again interval for a Relearning card', () => {
      const card = createFlashcard({ state: CardState.Relearning })

      const intervals = card.calculateNextReviewIntervals(NOW)

      expect(intervals).toEqual({
        again: '10 м',
        hard: '15 м',
        good: '1 мес',
        easy: '2 мес',
      })
    })

    it('formats intervals as months when scheduled days are between 30 and 365', () => {
      const card = createFlashcard({ stability: 50, scheduledDays: 50 })

      const intervals = card.calculateNextReviewIntervals(NOW)

      expect(intervals.good).toMatch(/^\d+ мес$/)
      expect(intervals.easy).toMatch(/^\d+ мес$/)
    })

    it('formats intervals as years when scheduled days exceed 365', () => {
      const card = createFlashcard({ stability: 2000, scheduledDays: 2000 })

      const intervals = card.calculateNextReviewIntervals(NOW)

      expect(intervals.hard).toMatch(/^\d+ г$/)
      expect(intervals.good).toMatch(/^\d+ г$/)
      expect(intervals.easy).toMatch(/^\d+ г$/)
      expect(intervals).toEqual({
        again: '10 м',
        hard: '6 г',
        good: '6 г',
        easy: '6 г',
      })
    })

    it('uses the provided "now" date instead of the current time', () => {
      const card = createFlashcard()
      const laterNow = new Date(NOW.getTime() + 365 * DAY_MS)

      // A later "now" means more days elapsed since the last review, so
      // retrievability drops and FSRS schedules longer intervals.
      expect(card.calculateNextReviewIntervals(laterNow)).toEqual({
        again: '10 м',
        hard: '3 мес',
        good: '4 мес',
        easy: '7 мес',
      })
      expect(card.calculateNextReviewIntervals(laterNow)).not.toEqual(card.calculateNextReviewIntervals(NOW))
    })
  })
})
