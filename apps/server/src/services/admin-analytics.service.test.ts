import type { AnalyticsRawDataset } from './admin-analytics.service'
import { describe, expect, it } from 'bun:test'
import {
  buildUserEngagements,
  calculateLlmCost,
  calculateStreaks,
  classifyUserSegment,
  computeAnalyticsOverview,
  pickLatestTimestamp,
  shiftDateStr,
  toUtcDateStr,
} from './admin-analytics.service'

describe('admin-analytics helpers', () => {
  it('parses UTC dates from ISO, SQLite datetime, and YYYY-MM-DD', () => {
    expect(toUtcDateStr('2026-11-25')).toBe('2026-11-25')
    expect(toUtcDateStr('2026-11-25 14:30:00')).toBe('2026-11-25')
    expect(toUtcDateStr('2026-11-25T14:30:00.000Z')).toBe('2026-11-25')
    expect(toUtcDateStr(null)).toBeNull()
    expect(toUtcDateStr('not-a-date')).toBeNull()
  })

  it('picks latest timestamp and prefers full timestamp over date-only on the same day', () => {
    expect(pickLatestTimestamp([
      '2026-11-24',
      '2026-11-25',
      '2026-11-25 09:15:00',
    ])).toBe('2026-11-25T09:15:00.000Z')

    expect(pickLatestTimestamp([
      '2026-11-20T22:00:00.000Z',
      '2026-11-23',
    ])).toBe('2026-11-23T00:00:00.000Z')

    expect(pickLatestTimestamp([null, undefined])).toBeNull()
  })

  it('classifies user lifecycle segments accurately', () => {
    const today = '2026-11-25'

    expect(classifyUserSegment({ hasActivationSignal: false, lastActiveAt: '2026-11-25T10:00:00Z', todayDateStr: today }))
      .toBe('never_activated')
    expect(classifyUserSegment({ hasActivationSignal: true, lastActiveAt: '2026-11-25T10:00:00Z', todayDateStr: today }))
      .toBe('active')
    expect(classifyUserSegment({ hasActivationSignal: true, lastActiveAt: '2026-11-18T10:00:00Z', todayDateStr: today }))
      .toBe('active')
    expect(classifyUserSegment({ hasActivationSignal: true, lastActiveAt: '2026-11-10T10:00:00Z', todayDateStr: today }))
      .toBe('cooling')
    expect(classifyUserSegment({ hasActivationSignal: true, lastActiveAt: '2026-10-01T10:00:00Z', todayDateStr: today }))
      .toBe('inactive')
  })

  it('calculates current and longest streaks', () => {
    const today = '2026-11-25'

    expect(calculateStreaks([], today)).toEqual({ currentStreak: 0, longestStreak: 0 })

    // 4-day historical streak, 2-day current streak ending yesterday
    expect(calculateStreaks([
      '2026-11-01',
      '2026-11-02',
      '2026-11-03',
      '2026-11-04',
      '2026-11-23',
      '2026-11-24',
    ], today)).toEqual({ currentStreak: 2, longestStreak: 4 })

    // Broken streak (last active 3 days ago)
    expect(calculateStreaks(['2026-11-20', '2026-11-21', '2026-11-22'], today))
      .toEqual({ currentStreak: 0, longestStreak: 3 })
  })

  it('calculates LLM cost using pricing table', () => {
    const cost = calculateLlmCost([{ model: 'gpt-4o-mini', inputTokens: 500_000, outputTokens: 250_000 }], { 'gpt-4o-mini': { input: 0.15, output: 0.6 } })
    expect(cost).toBeCloseTo(0.225, 5)
  })
})

describe('computeAnalyticsOverview', () => {
  const today = '2026-11-25'

  const dataset: AnalyticsRawDataset = {
    users: [
      {
        id: 1,
        username: 'power_reader',
        role: 'user',
        email: 'power@example.com',
        subscriptionTier: 'pro',
        tokenLimit: 1_000_000,
        bookLimit: 50,
        usedTokens: 50_000,
        createdAt: '2026-11-01 10:00:00',
        lastActiveAt: '2026-11-25T09:00:00.000Z',
        avatarUrl: null,
      },
      {
        id: 2,
        username: 'cooling_reader',
        role: 'user',
        email: 'cool@example.com',
        subscriptionTier: 'free',
        tokenLimit: 100_000,
        bookLimit: 3,
        usedTokens: 0,
        createdAt: '2026-11-01 10:00:00',
        lastActiveAt: null,
        avatarUrl: null,
      },
      {
        id: 3,
        username: 'ghost_user',
        role: 'user',
        email: null,
        subscriptionTier: 'free',
        tokenLimit: 100_000,
        bookLimit: 3,
        usedTokens: 0,
        createdAt: '2026-11-24 12:00:00',
        lastActiveAt: null,
        avatarUrl: null,
      },
    ],
    dailyActivity: [
      {
        userId: 1,
        date: '2026-11-24',
        wordsAdded: 5,
        wordsReviewed: 10,
        pagesRead: 12,
        activeSeconds: 1800,
        readingSeconds: 1200,
        srsSeconds: 400,
      },
      {
        userId: 1,
        date: '2026-11-25',
        wordsAdded: 3,
        wordsReviewed: 8,
        pagesRead: 6,
        activeSeconds: 900,
        readingSeconds: 600,
        srsSeconds: 200,
      },
      {
        userId: 2,
        date: '2026-11-10',
        wordsAdded: 0,
        wordsReviewed: 0,
        pagesRead: 4,
        activeSeconds: 300,
        readingSeconds: 300,
        srsSeconds: 0,
      },
    ],
    books: [
      { userId: 1, booksCount: 3 },
      { userId: 2, booksCount: 1 },
    ],
    progress: [
      { userId: 1, progressCount: 2, maxPage: 40, lastUpdatedAt: '2026-11-25 08:55:00' },
      { userId: 2, progressCount: 1, maxPage: 4, lastUpdatedAt: '2026-11-10 15:00:00' },
    ],
    dictionary: [
      {
        userId: 1,
        totalWords: 20,
        learnedWords: 8,
        reviewedWords: 12,
        lastUpdatedAt: '2026-11-25 08:30:00',
      },
    ],
    tokenUsage: [
      {
        userId: 1,
        date: '2026-11-25',
        action: 'analyze_sentence',
        model: 'test-model',
        inputTokens: 100_000,
        outputTokens: 50_000,
      },
    ],
    highlights: [{ userId: 1, count: 4, lastCreatedAt: '2026-11-24 12:00:00' }],
    quizzes: [],
    plugins: [{ userId: 1, count: 2 }],
    push: [{ userId: 1, count: 1 }],
  }

  it('computes DAU/WAU/MAU, segments, funnel, trend, and top users accurately', () => {
    const overview = computeAnalyticsOverview(
      dataset,
      7,
      { 'test-model': { input: 1, output: 2 } },
      today,
    )

    expect(overview.summary.totalUsers).toBe(3)
    expect(overview.summary.dau).toBe(1)
    expect(overview.summary.wau).toBe(1)
    expect(overview.summary.mau).toBe(2)
    expect(overview.summary.totalActiveSecondsPeriod).toBe(2700)
    expect(overview.summary.totalReadingSecondsPeriod).toBe(1800)
    expect(overview.summary.totalLlmCostPeriod).toBeCloseTo(0.2, 4)

    expect(overview.segments).toEqual({
      active: 1,
      cooling: 1,
      inactive: 0,
      neverActivated: 1,
    })

    expect(overview.funnel.map(s => [s.key, s.count])).toEqual([
      ['registered', 3],
      ['added_book', 2],
      ['read_pages', 2],
      ['used_ai_or_dict', 1],
      ['trained_srs', 1],
      ['retained', 1],
    ])

    expect(overview.dailyTrend).toHaveLength(7)
    expect(overview.dailyTrend[0].date).toBe(shiftDateStr(today, -6))
    expect(overview.dailyTrend[6].date).toBe(today)
    expect(overview.dailyTrend[6].activeUsers).toBe(1)
    expect(overview.dailyTrend[5].newUsers).toBe(1)

    expect(overview.topUsers[0].username).toBe('power_reader')
    expect(overview.topUsers[0].activeSeconds).toBe(2700)

    const engagements = buildUserEngagements(dataset, today)
    expect(engagements.find(e => e.user.id === 2)?.segment).toBe('cooling')
    expect(engagements.find(e => e.user.id === 3)?.segment).toBe('never_activated')
  })
})
