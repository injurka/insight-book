import type { UserMetricTile } from '../model'
import type { AdminUserDetailedAnalytics, UserDetail } from '~/03.domain/user'
import {
  formatDuration,
  formatLimit,
  formatRelativeTime,
  formatTokens,
  getUsageLevel,
  usagePercent,
} from '~/03.domain/user'

function buildLimitTiles(user: UserDetail): UserMetricTile[] {
  const tokensPercent = usagePercent(user.usedTokens, user.tokenLimit)
  const booksPercent = usagePercent(user.usedBooks, user.bookLimit)

  return [
    {
      key: 'tokens',
      icon: 'mdi:sparkles',
      label: 'Токены за период',
      value: `${formatTokens(user.usedTokens)} / ${formatTokens(user.tokenLimit)}`,
      progress: { percent: tokensPercent, level: getUsageLevel(tokensPercent) },
    },
    {
      key: 'books',
      icon: 'mdi:bookshelf',
      label: 'Книги за период',
      value: `${user.usedBooks} / ${formatLimit(user.bookLimit)}`,
      progress: { percent: booksPercent, level: getUsageLevel(booksPercent) },
    },
  ]
}

function buildActivityTiles(analytics: AdminUserDetailedAnalytics): UserMetricTile[] {
  const { time } = analytics
  const hasTime = time.totalActiveSeconds > 0

  return [
    {
      key: 'last-visit',
      icon: 'mdi:eye-outline',
      label: 'Последний визит',
      value: formatRelativeTime(analytics.lastActiveAt),
      hint: `${analytics.activeDaysTotal} акт. дн. всего`,
    },
    {
      key: 'time',
      icon: 'mdi:clock-outline',
      label: 'Время на сайте',
      value: formatDuration(time.totalActiveSeconds),
      hint: hasTime
        ? `7 дн: ${formatDuration(time.last7DaysSeconds)} · 30 дн: ${formatDuration(time.last30DaysSeconds)}`
        : 'Учёт ведётся с недавнего времени',
    },
    {
      key: 'streak',
      icon: 'mdi:fire',
      label: 'Серия дней',
      value: `${analytics.currentStreak} дн.`,
      hint: `рекорд: ${analytics.longestStreak} дн.`,
    },
  ]
}

/**
 * Compact KPI tiles for the user profile header: activity signals (when analytics is available)
 * followed by limit consumption for the current billing period.
 */
export function buildUserMetricTiles(user: UserDetail, analytics: AdminUserDetailedAnalytics | null): UserMetricTile[] {
  return [
    ...(analytics ? buildActivityTiles(analytics) : []),
    ...buildLimitTiles(user),
  ]
}
