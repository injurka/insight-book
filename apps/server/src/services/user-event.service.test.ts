import { describe, expect, it } from 'bun:test'
import { normalizeEventTimestamp, sanitizeEventMeta } from '../constants/product-events'
import { computeSequentialEventFunnel, prepareEventBatch } from './user-event.service'

describe('product-events sanitization and normalization', () => {
  it('redacts sensitive text fields to length and truncates long strings', () => {
    const meta = sanitizeEventMeta({
      bookId: 42,
      language: 'zh',
      word: '你好世界',
      query: 'detective stories',
      email: 'secret@example.com',
      nested: { ignored: true },
      longVal: 'x'.repeat(120),
    })

    expect(meta).toEqual({
      bookId: 42,
      language: 'zh',
      word_len: 4,
      query_len: 17,
      email_len: 18,
      longVal: 'x'.repeat(80),
    })
  })

  it('clamps future and very old timestamps', () => {
    const now = Date.parse('2026-11-25T12:00:00.000Z')

    // Future skew > 5m clamped to +5m
    expect(normalizeEventTimestamp('2026-11-26T12:00:00.000Z', now))
      .toBe('2026-11-25T12:05:00.000Z')

    // Past > 7d clamped to -7d
    expect(normalizeEventTimestamp('2026-10-01T12:00:00.000Z', now))
      .toBe('2026-11-18T12:00:00.000Z')

    // Valid recent timestamp preserved
    expect(normalizeEventTimestamp('2026-11-25T11:55:00.000Z', now))
      .toBe('2026-11-25T11:55:00.000Z')
  })

  it('filters client event batch to curated product events only', () => {
    const now = Date.parse('2026-11-25T12:00:00.000Z')
    const prepared = prepareEventBatch(7, [
      { event: 'page_view', meta: { url: '/reader' } },
      { event: 'theme_changed', meta: { theme: 'dark' } },
      { event: 'book_opened', meta: { bookId: 10, language: 'en' }, timestamp: '2026-11-25T11:58:00.000Z' },
      { event: 'word_saved_to_dict', meta: { language: 'en', word: 'serendipity' } },
      { event: 'unknown_custom_event' },
    ], now)

    expect(prepared).toEqual([
      {
        userId: 7,
        event: 'book_opened',
        meta: { bookId: 10, language: 'en' },
        createdAt: '2026-11-25T11:58:00.000Z',
      },
      {
        userId: 7,
        event: 'word_saved_to_dict',
        meta: { language: 'en', word_len: 11 },
        createdAt: '2026-11-25T12:00:00.000Z',
      },
    ])
  })
})

describe('computeSequentialEventFunnel', () => {
  it('enforces chronological order per user and computes conversion and median transition minutes', () => {
    const rows = [
      // User 1: completes all 3 steps in order (0m -> +10m -> +30m)
      { userId: 1, event: 'book_opened', createdAt: '2026-11-25T10:00:00.000Z' },
      { userId: 1, event: 'word_saved_to_dict', createdAt: '2026-11-25T10:10:00.000Z' },
      { userId: 1, event: 'srs_training_finished', createdAt: '2026-11-25T10:40:00.000Z' },

      // User 2: completes steps 1 & 2 (0m -> +20m), no step 3
      { userId: 2, event: 'book_opened', createdAt: '2026-11-25T11:00:00.000Z' },
      { userId: 2, event: 'word_saved_to_dict', createdAt: '2026-11-25T11:20:00.000Z' },

      // User 3: saved word BEFORE opening book — must NOT count for step 2!
      { userId: 3, event: 'word_saved_to_dict', createdAt: '2026-11-25T09:00:00.000Z' },
      { userId: 3, event: 'book_opened', createdAt: '2026-11-25T09:30:00.000Z' },
    ]

    const steps = computeSequentialEventFunnel(rows, [
      'book_opened',
      'word_saved_to_dict',
      'srs_training_finished',
    ])

    expect(steps).toEqual([
      {
        stepIndex: 1,
        event: 'book_opened',
        label: 'Открытие книги в читалке',
        usersCount: 3,
        percentOfFirst: 100,
        conversionFromPrev: 100,
        medianMinutesFromPrev: null,
      },
      {
        stepIndex: 2,
        event: 'word_saved_to_dict',
        label: 'Сохранение слова в словарь',
        usersCount: 2,
        percentOfFirst: 67,
        conversionFromPrev: 67,
        medianMinutesFromPrev: 15, // median of [10, 20]
      },
      {
        stepIndex: 3,
        event: 'srs_training_finished',
        label: 'Завершение SRS-тренировки',
        usersCount: 1,
        percentOfFirst: 33,
        conversionFromPrev: 50,
        medianMinutesFromPrev: 30,
      },
    ])
  })
})
