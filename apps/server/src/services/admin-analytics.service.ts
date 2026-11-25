import type {
  RawDailyActivityRow,
  RawTokenUsageRow,
  RawUserBaseRow,
  RawUserBooksAgg,
  RawUserCountAgg,
  RawUserDictionaryAgg,
  RawUserHighlightAgg,
  RawUserProgressAgg,
  RawUserQuizAgg,
} from '../repositories/admin-analytics.repository'
import type {
  AdminAnalyticsOverview,
  AdminUserDetailedAnalytics,
  AdminUserSortBy,
  AnalyticsDailyPoint,
  AnalyticsSegmentsSummary,
  FeatureAdoptionItem,
  FunnelStepMetric,
  SortDirection,
  TopEngagedUser,
  UserAnalyticsSummaryFields,
  UserFunnelStepStatus,
  UserHeatmapDay,
  UserLifecycleSegment,
  UserLlmActionUsage,
} from '../types/admin-analytics'
import { ERROR_CODES } from '../constants/error-codes'
import { adminAnalyticsRepository } from '../repositories/admin-analytics.repository'
import { userRepository } from '../repositories/user.repository'
import { getAiConfig } from '../utils/ai-config'
import { AppError } from '../utils/errors'
import { adminService } from './admin.service'

const MS_PER_DAY = 24 * 60 * 60 * 1000
const ACTIVE_WINDOW_DAYS = 7
const COOLING_WINDOW_DAYS = 30
const ACTIVATION_MIN_SECONDS = 60

interface PricingEntry {
  input: number
  output: number
}

export interface ComputedUserEngagement {
  user: RawUserBaseRow
  lastActiveAt: string | null
  segment: UserLifecycleSegment
  booksCount: number
  progressCount: number
  maxPage: number
  wordsCount: number
  learnedWords: number
  reviewedWords: number
  pagesRead: number
  wordsAdded: number
  wordsReviewed: number
  totalActiveSeconds: number
  totalReadingSeconds: number
  totalSrsSeconds: number
  highlightsCount: number
  quizzesCompleted: number
  pluginsCount: number
  pushEnabled: boolean
  usedAi: boolean
  activeDates: Set<string>
  funnel: {
    registered: boolean
    addedBook: boolean
    readPages: boolean
    usedAiOrDict: boolean
    trainedSrs: boolean
    retained: boolean
  }
}

/**
 * Extracts UTC calendar date YYYY-MM-DD from ISO, SQLite datetime, or date-only strings.
 */
export function toUtcDateStr(value: string | Date | null | undefined): string | null {
  if (!value)
    return null

  if (value instanceof Date)
    return Number.isNaN(value.getTime()) ? null : value.toISOString().slice(0, 10)

  const trimmed = value.trim()

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed))
    return trimmed

  const normalized = trimmed.includes('T') ? trimmed : `${trimmed.replace(' ', 'T')}Z`
  const parsed = new Date(normalized)

  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10)
}

/**
 * Normalizes SQLite / ISO / YYYY-MM-DD timestamps into comparable UTC epoch ms and ISO string.
 */
export function normalizeTimestamp(value: string | null | undefined): { iso: string, ms: number, isDateOnly: boolean } | null {
  if (!value)
    return null

  const trimmed = value.trim()

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const ms = Date.parse(`${trimmed}T00:00:00.000Z`)

    return Number.isNaN(ms) ? null : { iso: `${trimmed}T00:00:00.000Z`, ms, isDateOnly: true }
  }

  const withT = trimmed.includes('T') ? trimmed : trimmed.replace(' ', 'T')
  const withTz = /z|[+-]\d{2}:?\d{2}$/i.test(withT) ? withT : `${withT}Z`
  const ms = Date.parse(withTz)

  return Number.isNaN(ms) ? null : { iso: new Date(ms).toISOString(), ms, isDateOnly: false }
}

/**
 * Picks the latest timestamp across mixed full ISO and date-only sources.
 * If a full timestamp and a date-only marker fall on the same day, the full timestamp wins.
 */
export function pickLatestTimestamp(candidates: Array<string | null | undefined>): string | null {
  let best: { iso: string, ms: number, isDateOnly: boolean, date: string } | null = null

  for (const candidate of candidates) {
    const parsed = normalizeTimestamp(candidate)

    if (!parsed)
      continue

    const date = parsed.iso.slice(0, 10)

    if (!best) {
      best = { ...parsed, date }
      continue
    }

    if (date > best.date) {
      best = { ...parsed, date }
    }
    else if (date === best.date) {
      if (best.isDateOnly && !parsed.isDateOnly) {
        best = { ...parsed, date }
      }
      else if (best.isDateOnly === parsed.isDateOnly && parsed.ms > best.ms) {
        best = { ...parsed, date }
      }
    }
  }

  return best?.iso ?? null
}

/**
 * Calendar day difference between two YYYY-MM-DD strings (later - earlier).
 */
export function daysBetweenDates(earlierDateStr: string, laterDateStr: string): number {
  const earlierMs = Date.parse(`${earlierDateStr}T00:00:00.000Z`)
  const laterMs = Date.parse(`${laterDateStr}T00:00:00.000Z`)

  return Math.round((laterMs - earlierMs) / MS_PER_DAY)
}

/**
 * Shifts a YYYY-MM-DD string by `deltaDays`.
 */
export function shiftDateStr(baseDateStr: string, deltaDays: number): string {
  const ms = Date.parse(`${baseDateStr}T00:00:00.000Z`) + deltaDays * MS_PER_DAY

  return new Date(ms).toISOString().slice(0, 10)
}

/**
 * Classifies a user into lifecycle segments using activation signals + recency.
 */
export function classifyUserSegment(params: {
  hasActivationSignal: boolean
  lastActiveAt: string | null
  todayDateStr: string
}): UserLifecycleSegment {
  if (!params.hasActivationSignal)
    return 'never_activated'

  const lastDate = toUtcDateStr(params.lastActiveAt)

  if (!lastDate)
    return 'inactive'

  const diffDays = daysBetweenDates(lastDate, params.todayDateStr)

  if (diffDays <= ACTIVE_WINDOW_DAYS)
    return 'active'

  if (diffDays <= COOLING_WINDOW_DAYS)
    return 'cooling'

  return 'inactive'
}

/**
 * Calculates current streak (ending today or yesterday) and longest streak from a set of YYYY-MM-DD dates.
 */
export function calculateStreaks(activeDates: Iterable<string>, todayDateStr: string): { currentStreak: number, longestStreak: number } {
  const sorted = Array.from(new Set(activeDates)).sort()

  if (sorted.length === 0)
    return { currentStreak: 0, longestStreak: 0 }

  let longestStreak = 1
  let run = 1

  for (let i = 1; i < sorted.length; i++) {
    if (daysBetweenDates(sorted[i - 1], sorted[i]) === 1) {
      run++

      if (run > longestStreak)
        longestStreak = run
    }
    else {
      run = 1
    }
  }

  const lastDate = sorted[sorted.length - 1]
  const daysFromToday = daysBetweenDates(lastDate, todayDateStr)

  if (daysFromToday > 1)
    return { currentStreak: 0, longestStreak }

  let currentStreak = 1

  for (let i = sorted.length - 1; i > 0; i--) {
    if (daysBetweenDates(sorted[i - 1], sorted[i]) === 1)
      currentStreak++
    else
      break
  }

  return { currentStreak, longestStreak }
}

export function calculateLlmCost(rows: Array<{ model: string, inputTokens: number, outputTokens: number }>, pricing: Record<string, PricingEntry>): number {
  let total = 0

  for (const row of rows) {
    const rate = pricing[row.model]

    if (!rate)
      continue

    total += (row.inputTokens / 1_000_000) * rate.input + (row.outputTokens / 1_000_000) * rate.output
  }

  return total
}

function roundPercent(part: number, total: number): number {
  if (total <= 0)
    return 0

  return Math.round((part / total) * 100)
}

function toRecordMap<T extends { userId: number }>(rows: T[]): Map<number, T> {
  const map = new Map<number, T>()

  for (const row of rows)
    map.set(row.userId, row)

  return map
}

export interface AnalyticsRawDataset {
  users: RawUserBaseRow[]
  dailyActivity: RawDailyActivityRow[]
  books: RawUserBooksAgg[]
  progress: RawUserProgressAgg[]
  dictionary: RawUserDictionaryAgg[]
  tokenUsage: RawTokenUsageRow[]
  highlights: RawUserHighlightAgg[]
  quizzes: RawUserQuizAgg[]
  plugins: RawUserCountAgg[]
  push: RawUserCountAgg[]
}

export function buildUserEngagements(dataset: AnalyticsRawDataset, todayDateStr: string): ComputedUserEngagement[] {
  const booksMap = toRecordMap(dataset.books)
  const progressMap = toRecordMap(dataset.progress)
  const dictMap = toRecordMap(dataset.dictionary)
  const highlightsMap = toRecordMap(dataset.highlights)
  const quizMap = toRecordMap(dataset.quizzes)
  const pluginsMap = toRecordMap(dataset.plugins)
  const pushMap = toRecordMap(dataset.push)

  const dailyByUser = new Map<number, RawDailyActivityRow[]>()

  for (const row of dataset.dailyActivity) {
    const list = dailyByUser.get(row.userId)

    if (list)
      list.push(row)
    else
      dailyByUser.set(row.userId, [row])
  }

  const tokensByUser = new Map<number, RawTokenUsageRow[]>()

  for (const row of dataset.tokenUsage) {
    const list = tokensByUser.get(row.userId)

    if (list)
      list.push(row)
    else
      tokensByUser.set(row.userId, [row])
  }

  return dataset.users.map((user) => {
    const dailyRows = dailyByUser.get(user.id) ?? []
    const tokenRows = tokensByUser.get(user.id) ?? []
    const bookAgg = booksMap.get(user.id)
    const progAgg = progressMap.get(user.id)
    const dictAgg = dictMap.get(user.id)
    const hlAgg = highlightsMap.get(user.id)
    const quizAgg = quizMap.get(user.id)
    const pluginAgg = pluginsMap.get(user.id)
    const pushAgg = pushMap.get(user.id)

    let pagesRead = 0
    let wordsAdded = 0
    let wordsReviewed = 0
    let totalActiveSeconds = 0
    let totalReadingSeconds = 0
    let totalSrsSeconds = 0
    let latestDailyDate: string | null = null
    const activeDates = new Set<string>()

    for (const row of dailyRows) {
      pagesRead += row.pagesRead
      wordsAdded += row.wordsAdded
      wordsReviewed += row.wordsReviewed
      totalActiveSeconds += row.activeSeconds
      totalReadingSeconds += row.readingSeconds
      totalSrsSeconds += row.srsSeconds

      const hasDayAction = row.pagesRead > 0 || row.wordsAdded > 0 || row.wordsReviewed > 0 || row.activeSeconds > 0

      if (hasDayAction) {
        activeDates.add(row.date)

        if (!latestDailyDate || row.date > latestDailyDate)
          latestDailyDate = row.date
      }
    }

    let latestTokenDate: string | null = null

    for (const row of tokenRows) {
      if (row.inputTokens > 0 || row.outputTokens > 0) {
        activeDates.add(row.date)

        if (!latestTokenDate || row.date > latestTokenDate)
          latestTokenDate = row.date
      }
    }

    const userLastActiveDate = toUtcDateStr(user.lastActiveAt)

    if (userLastActiveDate)
      activeDates.add(userLastActiveDate)

    const progDate = toUtcDateStr(progAgg?.lastUpdatedAt)

    if (progDate)
      activeDates.add(progDate)

    const dictDate = toUtcDateStr(dictAgg?.lastUpdatedAt)

    if (dictDate)
      activeDates.add(dictDate)

    const lastActiveAt = pickLatestTimestamp([
      user.lastActiveAt,
      latestDailyDate,
      latestTokenDate,
      progAgg?.lastUpdatedAt,
      dictAgg?.lastUpdatedAt,
      hlAgg?.lastCreatedAt,
      quizAgg?.lastUpdatedAt,
    ])

    const booksCount = bookAgg?.booksCount ?? 0
    const progressCount = progAgg?.progressCount ?? 0
    const maxPage = progAgg?.maxPage ?? 0
    const wordsCount = dictAgg?.totalWords ?? 0
    const learnedWords = dictAgg?.learnedWords ?? 0
    const reviewedWords = dictAgg?.reviewedWords ?? 0
    const highlightsCount = hlAgg?.count ?? 0
    const quizzesCompleted = quizAgg?.completedCount ?? 0
    const pluginsCount = pluginAgg?.count ?? 0
    const pushEnabled = (pushAgg?.count ?? 0) > 0
    const usedAi = tokenRows.length > 0

    const addedBook = booksCount > 0 || progressCount > 0
    const readPages = pagesRead > 0 || maxPage > 1 || totalReadingSeconds >= 30
    const usedAiOrDict = usedAi || wordsCount > 0 || wordsAdded > 0
    const trainedSrs = wordsReviewed > 0 || reviewedWords > 0 || totalSrsSeconds >= 30
    const retained = activeDates.size >= 2

    const hasActivationSignal = addedBook || readPages || usedAiOrDict || trainedSrs || totalActiveSeconds >= ACTIVATION_MIN_SECONDS

    const segment = classifyUserSegment({
      hasActivationSignal,
      lastActiveAt,
      todayDateStr,
    })

    return {
      user,
      lastActiveAt,
      segment,
      booksCount,
      progressCount,
      maxPage,
      wordsCount,
      learnedWords,
      reviewedWords,
      pagesRead,
      wordsAdded,
      wordsReviewed,
      totalActiveSeconds,
      totalReadingSeconds,
      totalSrsSeconds,
      highlightsCount,
      quizzesCompleted,
      pluginsCount,
      pushEnabled,
      usedAi,
      activeDates,
      funnel: {
        registered: true,
        addedBook,
        readPages,
        usedAiOrDict,
        trainedSrs,
        retained,
      },
    }
  })
}

export function computeAnalyticsOverview(
  dataset: AnalyticsRawDataset,
  periodDays: number,
  pricing: Record<string, PricingEntry>,
  todayDateStr: string = toUtcDateStr(new Date())!,
): AdminAnalyticsOverview {
  const engagements = buildUserEngagements(dataset, todayDateStr)
  const totalUsers = engagements.length

  const startDateStr = shiftDateStr(todayDateStr, -(periodDays - 1))
  const weekStartStr = shiftDateStr(todayDateStr, -6)
  const monthStartStr = shiftDateStr(todayDateStr, -29)

  // DAU / WAU / MAU & lifecycle segments
  let dau = 0
  let wau = 0
  let mau = 0
  const segments: AnalyticsSegmentsSummary = {
    active: 0,
    cooling: 0,
    inactive: 0,
    neverActivated: 0,
  }

  for (const item of engagements) {
    if (item.segment === 'active')
      segments.active++
    else if (item.segment === 'cooling')
      segments.cooling++
    else if (item.segment === 'inactive')
      segments.inactive++
    else
      segments.neverActivated++

    let isDau = false
    let isWau = false
    let isMau = false

    for (const date of item.activeDates) {
      if (date === todayDateStr)
        isDau = true

      if (date >= weekStartStr && date <= todayDateStr)
        isWau = true

      if (date >= monthStartStr && date <= todayDateStr)
        isMau = true
    }

    if (isDau)
      dau++

    if (isWau)
      wau++

    if (isMau)
      mau++
  }

  // Funnel
  const rawSteps: Array<{ key: FunnelStepMetric['key'], label: string, description: string, count: number }> = [
    {
      key: 'registered',
      label: 'Регистрация',
      description: 'Создали аккаунт в InsightBook',
      count: totalUsers,
    },
    {
      key: 'added_book',
      label: 'Добавили книгу',
      description: 'Загрузили свою или открыли книгу из каталога',
      count: engagements.filter(e => e.funnel.addedBook).length,
    },
    {
      key: 'read_pages',
      label: 'Начали читать',
      description: 'Прочитали хотя бы 1 страницу или провели в читалке ≥30 сек.',
      count: engagements.filter(e => e.funnel.readPages).length,
    },
    {
      key: 'used_ai_or_dict',
      label: 'AI или словарь',
      description: 'Делали AI-разбор текста или сохраняли слова в словарь',
      count: engagements.filter(e => e.funnel.usedAiOrDict).length,
    },
    {
      key: 'trained_srs',
      label: 'Повторение (SRS)',
      description: 'Прошли хотя бы одно повторение слов',
      count: engagements.filter(e => e.funnel.trainedSrs).length,
    },
    {
      key: 'retained',
      label: 'Вернулись снова',
      description: 'Проявляли активность минимум в 2 разные даты',
      count: engagements.filter(e => e.funnel.retained).length,
    },
  ]

  const funnel: FunnelStepMetric[] = rawSteps.map((step, index) => {
    const prevCount = index === 0 ? totalUsers : rawSteps[index - 1].count

    return {
      ...step,
      percentOfTotal: roundPercent(step.count, totalUsers),
      conversionFromPrev: index === 0 ? (totalUsers > 0 ? 100 : 0) : roundPercent(step.count, prevCount),
    }
  })

  // Daily trend for the selected period (zero-filled for every date)
  const trendMap = new Map<string, {
    activeUserIds: Set<number>
    newUsers: number
    activeSeconds: number
    readingSeconds: number
    srsSeconds: number
    pagesRead: number
    wordsAdded: number
    wordsReviewed: number
  }>()

  for (let i = 0; i < periodDays; i++) {
    const date = shiftDateStr(startDateStr, i)
    trendMap.set(date, {
      activeUserIds: new Set<number>(),
      newUsers: 0,
      activeSeconds: 0,
      readingSeconds: 0,
      srsSeconds: 0,
      pagesRead: 0,
      wordsAdded: 0,
      wordsReviewed: 0,
    })
  }

  for (const user of dataset.users) {
    const regDate = toUtcDateStr(user.createdAt)
    const bucket = regDate ? trendMap.get(regDate) : undefined

    if (bucket)
      bucket.newUsers++
  }

  let totalActiveSecondsPeriod = 0
  let totalReadingSecondsPeriod = 0
  let totalPagesReadPeriod = 0
  let totalWordsAddedPeriod = 0
  let totalWordsReviewedPeriod = 0

  const periodStatsByUser = new Map<number, {
    activeSeconds: number
    readingSeconds: number
    srsSeconds: number
    pagesRead: number
    wordsAdded: number
    wordsReviewed: number
    llmCost: number
  }>()

  const ensurePeriodUser = (userId: number) => {
    let entry = periodStatsByUser.get(userId)

    if (!entry) {
      entry = {
        activeSeconds: 0,
        readingSeconds: 0,
        srsSeconds: 0,
        pagesRead: 0,
        wordsAdded: 0,
        wordsReviewed: 0,
        llmCost: 0,
      }
      periodStatsByUser.set(userId, entry)
    }

    return entry
  }

  for (const row of dataset.dailyActivity) {
    const bucket = trendMap.get(row.date)

    if (!bucket)
      continue

    const hasActivity = row.activeSeconds > 0 || row.pagesRead > 0 || row.wordsAdded > 0 || row.wordsReviewed > 0

    if (hasActivity)
      bucket.activeUserIds.add(row.userId)

    bucket.activeSeconds += row.activeSeconds
    bucket.readingSeconds += row.readingSeconds
    bucket.srsSeconds += row.srsSeconds
    bucket.pagesRead += row.pagesRead
    bucket.wordsAdded += row.wordsAdded
    bucket.wordsReviewed += row.wordsReviewed

    totalActiveSecondsPeriod += row.activeSeconds
    totalReadingSecondsPeriod += row.readingSeconds
    totalPagesReadPeriod += row.pagesRead
    totalWordsAddedPeriod += row.wordsAdded
    totalWordsReviewedPeriod += row.wordsReviewed

    const u = ensurePeriodUser(row.userId)
    u.activeSeconds += row.activeSeconds
    u.readingSeconds += row.readingSeconds
    u.srsSeconds += row.srsSeconds
    u.pagesRead += row.pagesRead
    u.wordsAdded += row.wordsAdded
    u.wordsReviewed += row.wordsReviewed
  }

  let totalLlmCostPeriod = 0

  for (const row of dataset.tokenUsage) {
    const bucket = trendMap.get(row.date)

    if (!bucket)
      continue

    if (row.inputTokens > 0 || row.outputTokens > 0)
      bucket.activeUserIds.add(row.userId)

    const cost = calculateLlmCost([row], pricing)
    totalLlmCostPeriod += cost
    ensurePeriodUser(row.userId).llmCost += cost
  }

  // Also include users whose lastActiveAt falls into a trend day even if dailyActivity has 0 actions
  for (const item of engagements) {
    const lastDate = toUtcDateStr(item.user.lastActiveAt)
    const bucket = lastDate ? trendMap.get(lastDate) : undefined

    if (bucket)
      bucket.activeUserIds.add(item.user.id)
  }

  const dailyTrend: AnalyticsDailyPoint[] = Array.from(trendMap.entries()).map(([date, b]) => ({
    date,
    activeUsers: b.activeUserIds.size,
    newUsers: b.newUsers,
    activeSeconds: b.activeSeconds,
    readingSeconds: b.readingSeconds,
    srsSeconds: b.srsSeconds,
    pagesRead: b.pagesRead,
    wordsAdded: b.wordsAdded,
    wordsReviewed: b.wordsReviewed,
  }))

  let totalActiveUserDays = 0

  for (const day of dailyTrend)
    totalActiveUserDays += day.activeUsers

  const avgDailyActiveSecondsPerActiveUser = totalActiveUserDays > 0
    ? Math.round(totalActiveSecondsPeriod / totalActiveUserDays)
    : 0

  // Feature adoption across all users
  const featureAdoptionSeed: Array<{ key: FeatureAdoptionItem['key'], label: string, usersCount: number }> = [
    { key: 'reader', label: 'Читалка', usersCount: engagements.filter(e => e.funnel.readPages).length },
    { key: 'ai', label: 'AI-анализ', usersCount: engagements.filter(e => e.usedAi).length },
    { key: 'dictionary', label: 'Словарь', usersCount: engagements.filter(e => e.wordsCount > 0 || e.wordsAdded > 0).length },
    { key: 'srs', label: 'Тренировки SRS', usersCount: engagements.filter(e => e.funnel.trainedSrs).length },
    { key: 'highlights', label: 'Заметки и хайлайты', usersCount: engagements.filter(e => e.highlightsCount > 0).length },
    { key: 'quizzes', label: 'Квизы', usersCount: engagements.filter(e => e.quizzesCompleted > 0).length },
    { key: 'plugins', label: 'Плагины', usersCount: engagements.filter(e => e.pluginsCount > 0).length },
    { key: 'push', label: 'Push-уведомления', usersCount: engagements.filter(e => e.pushEnabled).length },
  ]

  const featureAdoption: FeatureAdoptionItem[] = featureAdoptionSeed.map(item => ({
    ...item,
    percentOfTotal: roundPercent(item.usersCount, totalUsers),
  }))

  // Top engaged users in selected period (fallback to all-time activity score for ties)
  const topUsers: TopEngagedUser[] = engagements
    .map((item) => {
      const p = periodStatsByUser.get(item.user.id)

      return {
        id: item.user.id,
        username: item.user.username,
        avatarUrl: item.user.avatarUrl,
        subscriptionTier: item.user.subscriptionTier,
        segment: item.segment,
        lastActiveAt: item.lastActiveAt,
        activeSeconds: p?.activeSeconds ?? 0,
        readingSeconds: p?.readingSeconds ?? 0,
        srsSeconds: p?.srsSeconds ?? 0,
        pagesRead: p?.pagesRead ?? 0,
        wordsAdded: p?.wordsAdded ?? 0,
        wordsReviewed: p?.wordsReviewed ?? 0,
        booksCount: item.booksCount,
        llmCost: Number((p?.llmCost ?? 0).toFixed(4)),
      }
    })
    .sort((a, b) => {
      const scoreA = a.activeSeconds + (a.pagesRead * 45) + (a.wordsAdded * 15) + (a.wordsReviewed * 10)
      const scoreB = b.activeSeconds + (b.pagesRead * 45) + (b.wordsAdded * 15) + (b.wordsReviewed * 10)

      if (scoreB !== scoreA)
        return scoreB - scoreA

      return (b.lastActiveAt ?? '').localeCompare(a.lastActiveAt ?? '')
    })
    .slice(0, 10)

  return {
    periodDays,
    summary: {
      totalUsers,
      dau,
      wau,
      mau,
      activeSharePercent: roundPercent(wau, totalUsers),
      totalActiveSecondsPeriod,
      totalReadingSecondsPeriod,
      avgDailyActiveSecondsPerActiveUser,
      totalPagesReadPeriod,
      totalWordsAddedPeriod,
      totalWordsReviewedPeriod,
      totalLlmCostPeriod: Number(totalLlmCostPeriod.toFixed(4)),
    },
    segments,
    funnel,
    dailyTrend,
    featureAdoption,
    topUsers,
  }
}

export class AdminAnalyticsService {
  private async loadDataset(): Promise<AnalyticsRawDataset> {
    const [
      users,
      dailyActivity,
      books,
      progress,
      dictionary,
      tokenUsage,
      highlights,
      quizzes,
      plugins,
      push,
    ] = await Promise.all([
      adminAnalyticsRepository.getAllUsersBase(),
      adminAnalyticsRepository.getAllDailyActivity(),
      adminAnalyticsRepository.getBooksAggByUser(),
      adminAnalyticsRepository.getReadingProgressAggByUser(),
      adminAnalyticsRepository.getDictionaryAggByUser(),
      adminAnalyticsRepository.getAllTokenUsage(),
      adminAnalyticsRepository.getHighlightsAggByUser(),
      adminAnalyticsRepository.getQuizAggByUser(),
      adminAnalyticsRepository.getPluginsAggByUser(),
      adminAnalyticsRepository.getPushAggByUser(),
    ])

    return {
      users,
      dailyActivity,
      books,
      progress,
      dictionary,
      tokenUsage,
      highlights,
      quizzes,
      plugins,
      push,
    }
  }

  async getOverview(adminUserId: number, requestedDays: number = 30): Promise<AdminAnalyticsOverview> {
    await adminService.assertAdmin(adminUserId)

    const allowedDays = [7, 30, 90]
    const periodDays = allowedDays.includes(requestedDays) ? requestedDays : 30
    const dataset = await this.loadDataset()
    const pricing = getAiConfig().pricing

    return computeAnalyticsOverview(dataset, periodDays, pricing)
  }

  async listUsersWithAnalytics(adminUserId: number, opts: {
    page?: number
    limit?: number
    search?: string
    segment?: UserLifecycleSegment | 'all'
    sortBy?: AdminUserSortBy
    sortDir?: SortDirection
  }) {
    await adminService.assertAdmin(adminUserId)

    const page = Math.max(1, opts.page || 1)
    const limit = Math.max(1, Math.min(100, opts.limit || 20))
    const search = opts.search?.trim().toLowerCase()
    const segmentFilter = opts.segment && opts.segment !== 'all' ? opts.segment : null
    const sortBy: AdminUserSortBy = opts.sortBy ?? 'createdAt'
    const sortDir: SortDirection = opts.sortDir ?? 'desc'

    const todayDateStr = toUtcDateStr(new Date())!
    const dataset = await this.loadDataset()
    const engagements = buildUserEngagements(dataset, todayDateStr)

    const filtered = engagements.filter((item) => {
      if (segmentFilter && item.segment !== segmentFilter)
        return false

      if (search) {
        const usernameMatch = item.user.username.toLowerCase().includes(search)
        const emailMatch = (item.user.email ?? '').toLowerCase().includes(search)

        if (!usernameMatch && !emailMatch)
          return false
      }

      return true
    })

    const directionMultiplier = sortDir === 'asc' ? 1 : -1

    filtered.sort((a, b) => {
      let diff = 0

      switch (sortBy) {
        case 'lastActiveAt': {
          const msA = normalizeTimestamp(a.lastActiveAt)?.ms ?? 0
          const msB = normalizeTimestamp(b.lastActiveAt)?.ms ?? 0
          diff = msA - msB
          break
        }
        case 'activeSeconds':
          diff = a.totalActiveSeconds - b.totalActiveSeconds
          break
        case 'pagesRead':
          diff = a.pagesRead - b.pagesRead
          break
        case 'usedTokens':
          diff = a.user.usedTokens - b.user.usedTokens
          break
        case 'createdAt':
        default: {
          const msA = normalizeTimestamp(a.user.createdAt)?.ms ?? 0
          const msB = normalizeTimestamp(b.user.createdAt)?.ms ?? 0
          diff = msA - msB
          break
        }
      }

      return diff * directionMultiplier
    })

    const total = filtered.length
    const offset = (page - 1) * limit
    const pageRows = filtered.slice(offset, offset + limit).map((item): RawUserBaseRow & UserAnalyticsSummaryFields => ({
      ...item.user,
      lastActiveAt: item.lastActiveAt,
      segment: item.segment,
      totalActiveSeconds: item.totalActiveSeconds,
      totalReadingSeconds: item.totalReadingSeconds,
      booksCount: item.booksCount,
      wordsCount: item.wordsCount,
      pagesRead: item.pagesRead,
      activeDays: item.activeDates.size,
    }))

    return {
      data: pageRows,
      total,
      page,
      limit,
    }
  }

  async getUserDetailedAnalytics(adminUserId: number, targetUserId: number): Promise<AdminUserDetailedAnalytics> {
    await adminService.assertAdmin(adminUserId)

    const user = await userRepository.findById(targetUserId)

    if (!user)
      throw new AppError(404, ERROR_CODES.USER.NOT_FOUND, 'User not found')

    const todayDateStr = toUtcDateStr(new Date())!
    const since182Str = shiftDateStr(todayDateStr, -181)
    const since30Str = shiftDateStr(todayDateStr, -29)
    const since7Str = shiftDateStr(todayDateStr, -6)

    const [
      allDaily,
      tokenRows,
      recentBooks,
      booksCount,
      dictAgg,
      progAgg,
      hlAgg,
      quizAgg,
      pluginsCount,
      pushCount,
    ] = await Promise.all([
      adminAnalyticsRepository.getUserDailyActivity(targetUserId),
      adminAnalyticsRepository.getUserTokenUsage(targetUserId),
      adminAnalyticsRepository.getUserRecentBooks(targetUserId, 6),
      adminAnalyticsRepository.getUserBooksCount(targetUserId),
      adminAnalyticsRepository.getUserDictionaryAgg(targetUserId),
      adminAnalyticsRepository.getUserProgressAgg(targetUserId),
      adminAnalyticsRepository.getUserHighlightsAgg(targetUserId),
      adminAnalyticsRepository.getUserQuizAgg(targetUserId),
      adminAnalyticsRepository.getUserPluginsCount(targetUserId),
      adminAnalyticsRepository.getUserPushCount(targetUserId),
    ])

    let pagesRead = 0
    let wordsAdded = 0
    let wordsReviewed = 0
    let totalActiveSeconds = 0
    let totalReadingSeconds = 0
    let totalSrsSeconds = 0
    let last7DaysSeconds = 0
    let last30DaysSeconds = 0
    let latestDailyDate: string | null = null
    const activeDates = new Set<string>()
    const heatmap: UserHeatmapDay[] = []

    for (const row of allDaily) {
      pagesRead += row.pagesRead
      wordsAdded += row.wordsAdded
      wordsReviewed += row.wordsReviewed
      totalActiveSeconds += row.activeSeconds
      totalReadingSeconds += row.readingSeconds
      totalSrsSeconds += row.srsSeconds

      if (row.date >= since7Str && row.date <= todayDateStr)
        last7DaysSeconds += row.activeSeconds

      if (row.date >= since30Str && row.date <= todayDateStr)
        last30DaysSeconds += row.activeSeconds

      const actionsCount = row.pagesRead + row.wordsAdded + row.wordsReviewed
      const hasActivity = actionsCount > 0 || row.activeSeconds > 0

      if (hasActivity) {
        activeDates.add(row.date)

        if (!latestDailyDate || row.date > latestDailyDate)
          latestDailyDate = row.date
      }

      if (row.date >= since182Str) {
        heatmap.push({
          date: row.date,
          count: actionsCount + Math.floor(row.activeSeconds / 300),
          activeSeconds: row.activeSeconds,
          readingSeconds: row.readingSeconds,
          srsSeconds: row.srsSeconds,
          pagesRead: row.pagesRead,
          wordsAdded: row.wordsAdded,
          wordsReviewed: row.wordsReviewed,
        })
      }
    }

    const pricing = getAiConfig().pricing
    let latestTokenDate: string | null = null
    let totalInputTokens = 0
    let totalOutputTokens = 0
    let totalCost = 0
    const actionMap = new Map<string, UserLlmActionUsage>()

    for (const row of tokenRows) {
      if (row.inputTokens > 0 || row.outputTokens > 0) {
        activeDates.add(row.date)

        if (!latestTokenDate || row.date > latestTokenDate)
          latestTokenDate = row.date
      }

      const cost = calculateLlmCost([row], pricing)
      totalInputTokens += row.inputTokens
      totalOutputTokens += row.outputTokens
      totalCost += cost

      const existing = actionMap.get(row.action)

      if (existing) {
        existing.inputTokens += row.inputTokens
        existing.outputTokens += row.outputTokens
        existing.cost += cost
      }
      else {
        actionMap.set(row.action, {
          action: row.action,
          inputTokens: row.inputTokens,
          outputTokens: row.outputTokens,
          cost,
        })
      }
    }

    const userLastActiveDate = toUtcDateStr(user.lastActiveAt)

    if (userLastActiveDate)
      activeDates.add(userLastActiveDate)

    const progDate = toUtcDateStr(progAgg?.lastUpdatedAt)

    if (progDate)
      activeDates.add(progDate)

    const dictDate = toUtcDateStr(dictAgg?.lastUpdatedAt)

    if (dictDate)
      activeDates.add(dictDate)

    const lastActiveAt = pickLatestTimestamp([
      user.lastActiveAt,
      latestDailyDate,
      latestTokenDate,
      progAgg?.lastUpdatedAt,
      dictAgg?.lastUpdatedAt,
      hlAgg?.lastCreatedAt,
      quizAgg?.lastUpdatedAt,
    ])

    const addedBook = booksCount > 0 || (progAgg?.progressCount ?? 0) > 0
    const readPagesFlag = pagesRead > 0 || (progAgg?.maxPage ?? 0) > 1 || totalReadingSeconds >= 30
    const usedAiOrDict = tokenRows.length > 0 || (dictAgg?.totalWords ?? 0) > 0 || wordsAdded > 0
    const trainedSrs = wordsReviewed > 0 || (dictAgg?.reviewedWords ?? 0) > 0 || totalSrsSeconds >= 30
    const retained = activeDates.size >= 2
    const hasActivationSignal = addedBook || readPagesFlag || usedAiOrDict || trainedSrs || totalActiveSeconds >= ACTIVATION_MIN_SECONDS

    const segment = classifyUserSegment({
      hasActivationSignal,
      lastActiveAt,
      todayDateStr,
    })

    const { currentStreak, longestStreak } = calculateStreaks(activeDates, todayDateStr)

    let activeDaysLast30 = 0

    for (const date of activeDates) {
      if (date >= since30Str && date <= todayDateStr)
        activeDaysLast30++
    }

    const funnelSteps: UserFunnelStepStatus[] = [
      { key: 'registered', label: 'Регистрация', completed: true },
      { key: 'added_book', label: 'Добавил книгу', completed: addedBook },
      { key: 'read_pages', label: 'Начал читать', completed: readPagesFlag },
      { key: 'used_ai_or_dict', label: 'AI или словарь', completed: usedAiOrDict },
      { key: 'trained_srs', label: 'Повторение (SRS)', completed: trainedSrs },
      { key: 'retained', label: 'Вернулся снова', completed: retained },
    ]

    const byAction = Array.from(actionMap.values())
      .map(entry => ({ ...entry, cost: Number(entry.cost.toFixed(4)) }))
      .sort((a, b) => (b.inputTokens + b.outputTokens) - (a.inputTokens + a.outputTokens))

    return {
      userId: user.id,
      segment,
      lastActiveAt,
      activeDaysTotal: activeDates.size,
      activeDaysLast30,
      currentStreak,
      longestStreak,
      time: {
        totalActiveSeconds,
        totalReadingSeconds,
        totalSrsSeconds,
        last7DaysSeconds,
        last30DaysSeconds,
      },
      totals: {
        booksCount,
        pagesRead,
        totalWords: dictAgg?.totalWords ?? 0,
        learnedWords: dictAgg?.learnedWords ?? 0,
        wordsReviewed,
        highlightsCount: hlAgg?.count ?? 0,
        quizzesCompleted: quizAgg?.completedCount ?? 0,
        pluginsCount,
        pushEnabled: pushCount > 0,
      },
      funnelSteps,
      heatmap,
      recentBooks,
      llm: {
        totalCost: Number(totalCost.toFixed(4)),
        totalInputTokens,
        totalOutputTokens,
        byAction,
      },
    }
  }
}

export const adminAnalyticsService = new AdminAnalyticsService()
