import { and, desc, eq, gte, sql } from 'drizzle-orm'
import { db } from '../db'
import * as schema from '../db/schema'

export interface RawUserBaseRow {
  id: number
  username: string
  role: string
  email: string | null
  subscriptionTier: string
  tokenLimit: number | null
  bookLimit: number | null
  usedTokens: number
  createdAt: string
  lastActiveAt: string | null
  avatarUrl: string | null
}

export interface RawDailyActivityRow {
  userId: number
  date: string
  wordsAdded: number
  wordsReviewed: number
  pagesRead: number
  activeSeconds: number
  readingSeconds: number
  srsSeconds: number
}

export interface RawUserBooksAgg {
  userId: number
  booksCount: number
}

export interface RawUserProgressAgg {
  userId: number
  progressCount: number
  maxPage: number
  lastUpdatedAt: string | null
}

export interface RawUserDictionaryAgg {
  userId: number
  totalWords: number
  learnedWords: number
  reviewedWords: number
  lastUpdatedAt: string | null
}

export interface RawTokenUsageRow {
  userId: number
  date: string
  action: string
  model: string
  inputTokens: number
  outputTokens: number
}

export interface RawUserCountAgg {
  userId: number
  count: number
}

export interface RawUserHighlightAgg {
  userId: number
  count: number
  lastCreatedAt: string | null
}

export interface RawUserQuizAgg {
  userId: number
  completedCount: number
  lastUpdatedAt: string | null
}

export class AdminAnalyticsRepository {
  async getAllUsersBase(): Promise<RawUserBaseRow[]> {
    return db
      .select({
        id: schema.users.id,
        username: schema.users.username,
        role: schema.users.role,
        email: schema.users.email,
        subscriptionTier: schema.users.subscriptionTier,
        tokenLimit: schema.users.tokenLimit,
        bookLimit: schema.users.bookLimit,
        usedTokens: schema.users.usedTokens,
        createdAt: schema.users.createdAt,
        lastActiveAt: schema.users.lastActiveAt,
        avatarUrl: schema.users.avatarUrl,
      })
      .from(schema.users)
      .orderBy(desc(schema.users.createdAt))
  }

  async getAllDailyActivity(): Promise<RawDailyActivityRow[]> {
    return db
      .select({
        userId: schema.dailyActivity.userId,
        date: schema.dailyActivity.date,
        wordsAdded: schema.dailyActivity.wordsAdded,
        wordsReviewed: schema.dailyActivity.wordsReviewed,
        pagesRead: schema.dailyActivity.pagesRead,
        activeSeconds: schema.dailyActivity.activeSeconds,
        readingSeconds: schema.dailyActivity.readingSeconds,
        srsSeconds: schema.dailyActivity.srsSeconds,
      })
      .from(schema.dailyActivity)
  }

  async getBooksAggByUser(): Promise<RawUserBooksAgg[]> {
    return db
      .select({
        userId: schema.books.userId,
        booksCount: sql<number>`count(*)`.mapWith(Number),
      })
      .from(schema.books)
      .groupBy(schema.books.userId)
  }

  async getReadingProgressAggByUser(): Promise<RawUserProgressAgg[]> {
    return db
      .select({
        userId: schema.readingProgress.userId,
        progressCount: sql<number>`count(*)`.mapWith(Number),
        maxPage: sql<number>`COALESCE(MAX(${schema.readingProgress.currentPage}), 0)`.mapWith(Number),
        lastUpdatedAt: sql<string | null>`MAX(${schema.readingProgress.updatedAt})`,
      })
      .from(schema.readingProgress)
      .groupBy(schema.readingProgress.userId)
  }

  async getDictionaryAggByUser(): Promise<RawUserDictionaryAgg[]> {
    return db
      .select({
        userId: schema.userDictionary.userId,
        totalWords: sql<number>`count(*)`.mapWith(Number),
        learnedWords: sql<number>`SUM(CASE WHEN ${schema.userDictionary.state} = 2 THEN 1 ELSE 0 END)`.mapWith(Number),
        reviewedWords: sql<number>`SUM(CASE WHEN ${schema.userDictionary.reps} > 0 THEN 1 ELSE 0 END)`.mapWith(Number),
        lastUpdatedAt: sql<string | null>`MAX(${schema.userDictionary.updatedAt})`,
      })
      .from(schema.userDictionary)
      .groupBy(schema.userDictionary.userId)
  }

  async getAllTokenUsage(): Promise<RawTokenUsageRow[]> {
    return db
      .select({
        userId: schema.tokenUsage.userId,
        date: schema.tokenUsage.date,
        action: schema.tokenUsage.action,
        model: schema.tokenUsage.model,
        inputTokens: schema.tokenUsage.inputTokens,
        outputTokens: schema.tokenUsage.outputTokens,
      })
      .from(schema.tokenUsage)
  }

  async getHighlightsAggByUser(): Promise<RawUserHighlightAgg[]> {
    return db
      .select({
        userId: schema.highlights.userId,
        count: sql<number>`count(*)`.mapWith(Number),
        lastCreatedAt: sql<string | null>`MAX(${schema.highlights.createdAt})`,
      })
      .from(schema.highlights)
      .groupBy(schema.highlights.userId)
  }

  async getQuizAggByUser(): Promise<RawUserQuizAgg[]> {
    return db
      .select({
        userId: schema.userQuizProgress.userId,
        completedCount: sql<number>`SUM(CASE WHEN ${schema.userQuizProgress.bestScore} > 0 OR ${schema.userQuizProgress.stars} > 0 THEN 1 ELSE 0 END)`.mapWith(Number),
        lastUpdatedAt: sql<string | null>`MAX(${schema.userQuizProgress.updatedAt})`,
      })
      .from(schema.userQuizProgress)
      .groupBy(schema.userQuizProgress.userId)
  }

  async getPluginsAggByUser(): Promise<RawUserCountAgg[]> {
    return db
      .select({
        userId: schema.userPlugins.userId,
        count: sql<number>`count(*)`.mapWith(Number),
      })
      .from(schema.userPlugins)
      .where(eq(schema.userPlugins.isEnabled, true))
      .groupBy(schema.userPlugins.userId)
  }

  async getPushAggByUser(): Promise<RawUserCountAgg[]> {
    return db
      .select({
        userId: schema.webPushSubscriptions.userId,
        count: sql<number>`count(*)`.mapWith(Number),
      })
      .from(schema.webPushSubscriptions)
      .groupBy(schema.webPushSubscriptions.userId)
  }

  async getUserDailyActivity(userId: number): Promise<RawDailyActivityRow[]> {
    return db
      .select({
        userId: schema.dailyActivity.userId,
        date: schema.dailyActivity.date,
        wordsAdded: schema.dailyActivity.wordsAdded,
        wordsReviewed: schema.dailyActivity.wordsReviewed,
        pagesRead: schema.dailyActivity.pagesRead,
        activeSeconds: schema.dailyActivity.activeSeconds,
        readingSeconds: schema.dailyActivity.readingSeconds,
        srsSeconds: schema.dailyActivity.srsSeconds,
      })
      .from(schema.dailyActivity)
      .where(eq(schema.dailyActivity.userId, userId))
      .orderBy(desc(schema.dailyActivity.date))
  }

  async getUserDailyActivitySince(userId: number, sinceDateStr: string): Promise<RawDailyActivityRow[]> {
    return db
      .select({
        userId: schema.dailyActivity.userId,
        date: schema.dailyActivity.date,
        wordsAdded: schema.dailyActivity.wordsAdded,
        wordsReviewed: schema.dailyActivity.wordsReviewed,
        pagesRead: schema.dailyActivity.pagesRead,
        activeSeconds: schema.dailyActivity.activeSeconds,
        readingSeconds: schema.dailyActivity.readingSeconds,
        srsSeconds: schema.dailyActivity.srsSeconds,
      })
      .from(schema.dailyActivity)
      .where(and(eq(schema.dailyActivity.userId, userId), gte(schema.dailyActivity.date, sinceDateStr)))
      .orderBy(desc(schema.dailyActivity.date))
  }

  async getUserTokenUsage(userId: number): Promise<RawTokenUsageRow[]> {
    return db
      .select({
        userId: schema.tokenUsage.userId,
        date: schema.tokenUsage.date,
        action: schema.tokenUsage.action,
        model: schema.tokenUsage.model,
        inputTokens: schema.tokenUsage.inputTokens,
        outputTokens: schema.tokenUsage.outputTokens,
      })
      .from(schema.tokenUsage)
      .where(eq(schema.tokenUsage.userId, userId))
  }

  async getUserRecentBooks(userId: number, limit: number = 6) {
    return db
      .select({
        bookId: schema.readingProgress.bookId,
        title: schema.books.title,
        language: schema.books.language,
        currentPage: schema.readingProgress.currentPage,
        totalPages: schema.books.totalPages,
        status: schema.readingProgress.status,
        updatedAt: schema.readingProgress.updatedAt,
      })
      .from(schema.readingProgress)
      .innerJoin(schema.books, eq(schema.readingProgress.bookId, schema.books.id))
      .where(eq(schema.readingProgress.userId, userId))
      .orderBy(desc(schema.readingProgress.updatedAt))
      .limit(limit)
  }

  async getUserBooksCount(userId: number): Promise<number> {
    const row = await db
      .select({ count: sql<number>`count(*)`.mapWith(Number) })
      .from(schema.books)
      .where(eq(schema.books.userId, userId))
      .get()

    return row?.count ?? 0
  }

  async getUserDictionaryAgg(userId: number): Promise<RawUserDictionaryAgg | null> {
    const row = await db
      .select({
        userId: schema.userDictionary.userId,
        totalWords: sql<number>`count(*)`.mapWith(Number),
        learnedWords: sql<number>`SUM(CASE WHEN ${schema.userDictionary.state} = 2 THEN 1 ELSE 0 END)`.mapWith(Number),
        reviewedWords: sql<number>`SUM(CASE WHEN ${schema.userDictionary.reps} > 0 THEN 1 ELSE 0 END)`.mapWith(Number),
        lastUpdatedAt: sql<string | null>`MAX(${schema.userDictionary.updatedAt})`,
      })
      .from(schema.userDictionary)
      .where(eq(schema.userDictionary.userId, userId))
      .groupBy(schema.userDictionary.userId)
      .get()

    return row ?? null
  }

  async getUserProgressAgg(userId: number): Promise<RawUserProgressAgg | null> {
    const row = await db
      .select({
        userId: schema.readingProgress.userId,
        progressCount: sql<number>`count(*)`.mapWith(Number),
        maxPage: sql<number>`COALESCE(MAX(${schema.readingProgress.currentPage}), 0)`.mapWith(Number),
        lastUpdatedAt: sql<string | null>`MAX(${schema.readingProgress.updatedAt})`,
      })
      .from(schema.readingProgress)
      .where(eq(schema.readingProgress.userId, userId))
      .groupBy(schema.readingProgress.userId)
      .get()

    return row ?? null
  }

  async getUserHighlightsAgg(userId: number): Promise<RawUserHighlightAgg | null> {
    const row = await db
      .select({
        userId: schema.highlights.userId,
        count: sql<number>`count(*)`.mapWith(Number),
        lastCreatedAt: sql<string | null>`MAX(${schema.highlights.createdAt})`,
      })
      .from(schema.highlights)
      .where(eq(schema.highlights.userId, userId))
      .groupBy(schema.highlights.userId)
      .get()

    return row ?? null
  }

  async getUserQuizAgg(userId: number): Promise<RawUserQuizAgg | null> {
    const row = await db
      .select({
        userId: schema.userQuizProgress.userId,
        completedCount: sql<number>`SUM(CASE WHEN ${schema.userQuizProgress.bestScore} > 0 OR ${schema.userQuizProgress.stars} > 0 THEN 1 ELSE 0 END)`.mapWith(Number),
        lastUpdatedAt: sql<string | null>`MAX(${schema.userQuizProgress.updatedAt})`,
      })
      .from(schema.userQuizProgress)
      .where(eq(schema.userQuizProgress.userId, userId))
      .groupBy(schema.userQuizProgress.userId)
      .get()

    return row ?? null
  }

  async getUserPluginsCount(userId: number): Promise<number> {
    const row = await db
      .select({ count: sql<number>`count(*)`.mapWith(Number) })
      .from(schema.userPlugins)
      .where(and(eq(schema.userPlugins.userId, userId), eq(schema.userPlugins.isEnabled, true)))
      .get()

    return row?.count ?? 0
  }

  async getUserPushCount(userId: number): Promise<number> {
    const row = await db
      .select({ count: sql<number>`count(*)`.mapWith(Number) })
      .from(schema.webPushSubscriptions)
      .where(eq(schema.webPushSubscriptions.userId, userId))
      .get()

    return row?.count ?? 0
  }
}

export const adminAnalyticsRepository = new AdminAnalyticsRepository()
