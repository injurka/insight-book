import type { EventMetaRecord, ProductEventCategory, ProductEventName } from '../constants/product-events'

export type UserLifecycleSegment = 'active' | 'cooling' | 'inactive' | 'never_activated'

export type AdminUserSortBy = 'createdAt' | 'lastActiveAt' | 'activeSeconds' | 'pagesRead' | 'usedTokens'
export type SortDirection = 'asc' | 'desc'

export interface FunnelStepMetric {
  key: 'registered' | 'added_book' | 'read_pages' | 'used_ai_or_dict' | 'trained_srs' | 'retained'
  label: string
  description: string
  count: number
  percentOfTotal: number
  conversionFromPrev: number
}

export interface AnalyticsSegmentsSummary {
  active: number
  cooling: number
  inactive: number
  neverActivated: number
}

export interface AnalyticsDailyPoint {
  date: string
  activeUsers: number
  newUsers: number
  activeSeconds: number
  readingSeconds: number
  srsSeconds: number
  pagesRead: number
  wordsAdded: number
  wordsReviewed: number
}

export interface FeatureAdoptionItem {
  key: 'reader' | 'ai' | 'dictionary' | 'srs' | 'highlights' | 'quizzes' | 'plugins' | 'push'
  label: string
  usersCount: number
  percentOfTotal: number
}

export interface TopEngagedUser {
  id: number
  username: string
  avatarUrl: string | null
  subscriptionTier: string
  segment: UserLifecycleSegment
  lastActiveAt: string | null
  activeSeconds: number
  readingSeconds: number
  srsSeconds: number
  pagesRead: number
  wordsAdded: number
  wordsReviewed: number
  booksCount: number
  llmCost: number
}

export interface AdminAnalyticsOverview {
  periodDays: number
  summary: {
    totalUsers: number
    dau: number
    wau: number
    mau: number
    activeSharePercent: number
    totalActiveSecondsPeriod: number
    totalReadingSecondsPeriod: number
    avgDailyActiveSecondsPerActiveUser: number
    totalPagesReadPeriod: number
    totalWordsAddedPeriod: number
    totalWordsReviewedPeriod: number
    totalLlmCostPeriod: number
  }
  segments: AnalyticsSegmentsSummary
  funnel: FunnelStepMetric[]
  dailyTrend: AnalyticsDailyPoint[]
  featureAdoption: FeatureAdoptionItem[]
  topUsers: TopEngagedUser[]
}

export interface UserAnalyticsSummaryFields {
  lastActiveAt: string | null
  segment: UserLifecycleSegment
  totalActiveSeconds: number
  totalReadingSeconds: number
  booksCount: number
  wordsCount: number
  pagesRead: number
  activeDays: number
}

export interface UserHeatmapDay {
  date: string
  count: number
  activeSeconds: number
  readingSeconds: number
  srsSeconds: number
  pagesRead: number
  wordsAdded: number
  wordsReviewed: number
}

export interface UserRecentBook {
  bookId: number
  title: string
  language: string
  currentPage: number
  totalPages: number
  status: string
  updatedAt: string
}

export interface UserLlmActionUsage {
  action: string
  inputTokens: number
  outputTokens: number
  cost: number
}

export interface UserFunnelStepStatus {
  key: FunnelStepMetric['key']
  label: string
  completed: boolean
}

export interface AdminUserDetailedAnalytics {
  userId: number
  segment: UserLifecycleSegment
  lastActiveAt: string | null
  activeDaysTotal: number
  activeDaysLast30: number
  currentStreak: number
  longestStreak: number
  time: {
    totalActiveSeconds: number
    totalReadingSeconds: number
    totalSrsSeconds: number
    last7DaysSeconds: number
    last30DaysSeconds: number
  }
  totals: {
    booksCount: number
    pagesRead: number
    totalWords: number
    learnedWords: number
    wordsReviewed: number
    highlightsCount: number
    quizzesCompleted: number
    pluginsCount: number
    pushEnabled: boolean
  }
  funnelSteps: UserFunnelStepStatus[]
  heatmap: UserHeatmapDay[]
  recentBooks: UserRecentBook[]
  llm: {
    totalCost: number
    totalInputTokens: number
    totalOutputTokens: number
    byAction: UserLlmActionUsage[]
  }
}

export interface ProductEventCatalogItem {
  name: ProductEventName
  category: ProductEventCategory
  label: string
}

export interface ProductEventBreakdownItem {
  event: string
  category: ProductEventCategory
  label: string
  totalCount: number
  uniqueUsers: number
  percentOfUsers: number
}

export interface ProductEventCategorySummary {
  category: ProductEventCategory
  label: string
  totalCount: number
  uniqueUsers: number
}

export interface ProductEventFeedItem {
  id: number
  userId: number
  username: string
  avatarUrl: string | null
  event: string
  category: ProductEventCategory
  label: string
  meta: EventMetaRecord | null
  createdAt: string
}

export interface CustomFunnelStepResult {
  stepIndex: number
  event: string
  label: string
  usersCount: number
  percentOfFirst: number
  conversionFromPrev: number
  medianMinutesFromPrev: number | null
}

export interface AdminEventsOverview {
  periodDays: number
  retentionDays: number
  totalStoredEvents: number
  totalPeriodEvents: number
  activeEventUsersPeriod: number
  catalog: ProductEventCatalogItem[]
  byCategory: ProductEventCategorySummary[]
  topEvents: ProductEventBreakdownItem[]
}

export interface AdminEventStreamResponse {
  data: ProductEventFeedItem[]
  total: number
  page: number
  limit: number
}

export interface AdminUserEventsResponse extends AdminEventStreamResponse {
  topEvents: Array<{
    event: string
    category: ProductEventCategory
    label: string
    count: number
  }>
}

export interface AdminCustomFunnelResponse {
  periodDays: number
  steps: CustomFunnelStepResult[]
}
