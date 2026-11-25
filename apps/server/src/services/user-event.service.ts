import type { ProductEventCategory } from '../constants/product-events'
import type { InsertUserEventRow, RawEventFunnelRow } from '../repositories/user-event.repository'
import type {
  AdminCustomFunnelResponse,
  AdminEventsOverview,
  AdminEventStreamResponse,
  AdminUserEventsResponse,
  CustomFunnelStepResult,
  ProductEventBreakdownItem,
  ProductEventCategorySummary,
  ProductEventFeedItem,
} from '../types/admin-analytics'
import { ERROR_CODES } from '../constants/error-codes'
import {
  isAllowedProductEvent,
  MAX_EVENTS_PER_BATCH,
  normalizeEventTimestamp,
  PRODUCT_EVENT_CATALOG,
  sanitizeEventMeta,
  USER_EVENTS_RETENTION_DAYS,
} from '../constants/product-events'
import { userEventRepository } from '../repositories/user-event.repository'
import { userRepository } from '../repositories/user.repository'
import { AppError } from '../utils/errors'
import { logger } from '../utils/logger'
import { adminService } from './admin.service'

const MS_PER_DAY = 24 * 60 * 60 * 1000

const CATEGORY_LABELS: Record<ProductEventCategory, string> = {
  reader: 'Читалка',
  ai: 'AI-анализ',
  learning: 'Словарь, SRS и квизы',
  library: 'Библиотека и каталог',
  auth: 'Аккаунт и вход',
}

const EVENT_META_MAP = new Map<string, { category: ProductEventCategory, label: string }>(PRODUCT_EVENT_CATALOG.map(item => [item.name, { category: item.category, label: item.label }]))

export interface IncomingClientEvent {
  event: string
  meta?: Record<string, unknown> | null
  timestamp?: string | null
}

function getEventInfo(event: string): { category: ProductEventCategory, label: string } {
  return EVENT_META_MAP.get(event) ?? { category: 'learning', label: event }
}

function roundPercent(part: number, total: number): number {
  if (total <= 0)
    return 0

  return Math.round((part / total) * 100)
}

function computeMedian(values: number[]): number | null {
  if (values.length === 0)
    return null

  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)

  if (sorted.length % 2 === 1)
    return Math.round(sorted[mid] * 10) / 10

  return Math.round(((sorted[mid - 1] + sorted[mid]) / 2) * 10) / 10
}

/**
 * Validates, filters to allowed product events, sanitizes metadata, and normalizes timestamps.
 */
export function prepareEventBatch(userId: number, rawEvents: IncomingClientEvent[], nowMs: number = Date.now()): InsertUserEventRow[] {
  const limited = rawEvents.slice(0, MAX_EVENTS_PER_BATCH)
  const prepared: InsertUserEventRow[] = []

  for (const item of limited) {
    if (!item || typeof item.event !== 'string')
      continue

    const eventName = item.event.trim()

    if (!isAllowedProductEvent(eventName))
      continue

    prepared.push({
      userId,
      event: eventName,
      meta: sanitizeEventMeta(item.meta),
      createdAt: normalizeEventTimestamp(item.timestamp, nowMs),
    })
  }

  return prepared
}

/**
 * Computes a strict sequential funnel across ordered user event rows.
 * A user advances from step (k-1) to step (k) if they have an occurrence of stepEvents[k]
 * with timestamp >= the timestamp at which they completed step (k-1).
 */
export function computeSequentialEventFunnel(rows: RawEventFunnelRow[], stepEvents: string[]): CustomFunnelStepResult[] {
  const validSteps = stepEvents.filter(Boolean).slice(0, 6)

  if (validSteps.length === 0)
    return []

  const eventsByUser = new Map<number, Array<{ event: string, ms: number }>>()

  for (const row of rows) {
    const ms = Date.parse(row.createdAt)

    if (Number.isNaN(ms))
      continue

    const list = eventsByUser.get(row.userId)

    if (list)
      list.push({ event: row.event, ms })
    else
      eventsByUser.set(row.userId, [{ event: row.event, ms }])
  }

  const stepCounts = Array.from<number>({ length: validSteps.length }).fill(0)
  const stepDeltasMinutes: number[][] = Array.from({ length: validSteps.length }, () => [])

  for (const timeline of eventsByUser.values()) {
    timeline.sort((a, b) => a.ms - b.ms)

    let cursorIdx = 0
    let prevStepMs = 0

    for (let stepIdx = 0; stepIdx < validSteps.length; stepIdx++) {
      const targetEvent = validSteps[stepIdx]
      let matchedMs: number | null = null

      while (cursorIdx < timeline.length) {
        const current = timeline[cursorIdx]
        cursorIdx++

        if (current.event === targetEvent && (stepIdx === 0 || current.ms >= prevStepMs)) {
          matchedMs = current.ms
          break
        }
      }

      if (matchedMs === null)
        break

      stepCounts[stepIdx]++

      if (stepIdx > 0) {
        const deltaMin = Math.max(0, (matchedMs - prevStepMs) / 60_000)
        stepDeltasMinutes[stepIdx].push(deltaMin)
      }

      prevStepMs = matchedMs
    }
  }

  const firstCount = stepCounts[0] ?? 0

  return validSteps.map((event, idx) => {
    const usersCount = stepCounts[idx]
    const prevCount = idx === 0 ? usersCount : stepCounts[idx - 1]

    return {
      stepIndex: idx + 1,
      event,
      label: getEventInfo(event).label,
      usersCount,
      percentOfFirst: idx === 0 ? (usersCount > 0 ? 100 : 0) : roundPercent(usersCount, firstCount),
      conversionFromPrev: idx === 0 ? (usersCount > 0 ? 100 : 0) : roundPercent(usersCount, prevCount),
      medianMinutesFromPrev: idx === 0 ? null : computeMedian(stepDeltasMinutes[idx]),
    }
  })
}

export class UserEventService {
  async ingestClientEvents(userId: number, rawEvents: IncomingClientEvent[]): Promise<{ accepted: number }> {
    if (!Array.isArray(rawEvents) || rawEvents.length === 0)
      return { accepted: 0 }

    const nowMs = Date.now()
    const rows = prepareEventBatch(userId, rawEvents, nowMs)

    if (rows.length === 0)
      return { accepted: 0 }

    await userEventRepository.insertBatch(rows, new Date(nowMs).toISOString())

    return { accepted: rows.length }
  }

  async recordServerEvent(userId: number, event: string, meta?: Record<string, unknown>): Promise<void> {
    if (!isAllowedProductEvent(event))
      return

    try {
      const nowIso = new Date().toISOString()
      await userEventRepository.insertBatch([
        {
          userId,
          event,
          meta: sanitizeEventMeta(meta),
          createdAt: nowIso,
        },
      ], nowIso)
    }
    catch (err) {
      logger.warn(err, `[UserEvents] Failed to record server event "${event}" for user ${userId}`)
    }
  }

  async cleanupExpiredEvents(retentionDays: number = USER_EVENTS_RETENTION_DAYS): Promise<{
    deletedCount: number
    retentionDays: number
    cutoffIso: string
  }> {
    const safeDays = Math.max(7, Math.min(365, Math.round(retentionDays)))
    const cutoffIso = new Date(Date.now() - safeDays * MS_PER_DAY).toISOString()
    const deletedCount = await userEventRepository.deleteOlderThan(cutoffIso)

    if (deletedCount > 0)
      logger.info(`[UserEvents] Cleaned up ${deletedCount} events older than ${safeDays} days (${cutoffIso})`)

    return {
      deletedCount,
      retentionDays: safeDays,
      cutoffIso,
    }
  }

  async getAdminEventsOverview(adminUserId: number, requestedDays: number = 30): Promise<AdminEventsOverview> {
    await adminService.assertAdmin(adminUserId)

    const allowedDays = [7, 30, 90]
    const periodDays = allowedDays.includes(requestedDays) ? requestedDays : 30
    const sinceIso = new Date(Date.now() - periodDays * MS_PER_DAY).toISOString()

    const [
      totalStoredEvents,
      activeEventUsersPeriod,
      breakdownRows,
      totalUsers,
    ] = await Promise.all([
      userEventRepository.countAll(),
      userEventRepository.countDistinctUsersSince(sinceIso),
      userEventRepository.getBreakdownSince(sinceIso),
      userRepository.count(),
    ])

    let totalPeriodEvents = 0
    const categoryTotals = new Map<ProductEventCategory, number>()

    const topEvents: ProductEventBreakdownItem[] = breakdownRows.map((row) => {
      totalPeriodEvents += row.totalCount
      const info = getEventInfo(row.event)
      categoryTotals.set(info.category, (categoryTotals.get(info.category) ?? 0) + row.totalCount)

      return {
        event: row.event,
        category: info.category,
        label: info.label,
        totalCount: row.totalCount,
        uniqueUsers: row.uniqueUsers,
        percentOfUsers: roundPercent(row.uniqueUsers, totalUsers),
      }
    })

    const categoriesOrder: ProductEventCategory[] = ['reader', 'ai', 'learning', 'library', 'auth']
    const categoryUniqueCounts = await Promise.all(categoriesOrder.map((cat) => {
      const catEvents = PRODUCT_EVENT_CATALOG.filter(e => e.category === cat).map(e => e.name)

      return userEventRepository.getDistinctUsersByEventsSince(sinceIso, catEvents)
    }))

    const byCategory: ProductEventCategorySummary[] = categoriesOrder.map((category, idx) => ({
      category,
      label: CATEGORY_LABELS[category],
      totalCount: categoryTotals.get(category) ?? 0,
      uniqueUsers: categoryUniqueCounts[idx],
    }))

    return {
      periodDays,
      retentionDays: USER_EVENTS_RETENTION_DAYS,
      totalStoredEvents,
      totalPeriodEvents,
      activeEventUsersPeriod,
      catalog: PRODUCT_EVENT_CATALOG.map(e => ({ name: e.name, category: e.category, label: e.label })),
      byCategory,
      topEvents,
    }
  }

  async getAdminCustomFunnel(adminUserId: number, stepEvents: string[], requestedDays: number = 30): Promise<AdminCustomFunnelResponse> {
    await adminService.assertAdmin(adminUserId)

    const allowedDays = [7, 30, 90]
    const periodDays = allowedDays.includes(requestedDays) ? requestedDays : 30
    const sanitizedSteps = stepEvents
      .map(s => s.trim())
      .filter(s => isAllowedProductEvent(s))
      .slice(0, 6)

    if (sanitizedSteps.length < 2) {
      return { periodDays, steps: [] }
    }

    const sinceIso = new Date(Date.now() - periodDays * MS_PER_DAY).toISOString()
    const uniqueEvents = Array.from(new Set(sanitizedSteps))
    const rows = await userEventRepository.getFunnelRowsSince(sinceIso, uniqueEvents)
    const steps = computeSequentialEventFunnel(rows, sanitizedSteps)

    return {
      periodDays,
      steps,
    }
  }

  async listAdminEvents(adminUserId: number, opts: {
    page?: number
    limit?: number
    event?: string
    category?: ProductEventCategory | 'all'
    userId?: number
  }): Promise<AdminEventStreamResponse> {
    await adminService.assertAdmin(adminUserId)

    const page = Math.max(1, opts.page || 1)
    const limit = Math.max(1, Math.min(100, opts.limit || 30))
    const offset = (page - 1) * limit

    let eventsFilter: string[] | undefined

    if (opts.event && opts.event !== 'all') {
      eventsFilter = [opts.event]
    }
    else if (opts.category && opts.category !== 'all') {
      eventsFilter = PRODUCT_EVENT_CATALOG.filter(e => e.category === opts.category).map(e => e.name)
    }

    const { rows, total } = await userEventRepository.listEvents({
      userId: opts.userId,
      events: eventsFilter,
      limit,
      offset,
    })

    const data: ProductEventFeedItem[] = rows.map((row) => {
      const info = getEventInfo(row.event)

      return {
        id: row.id,
        userId: row.userId,
        username: row.username,
        avatarUrl: row.avatarUrl,
        event: row.event,
        category: info.category,
        label: info.label,
        meta: row.meta,
        createdAt: row.createdAt,
      }
    })

    return {
      data,
      total,
      page,
      limit,
    }
  }

  async getAdminUserEvents(adminUserId: number, targetUserId: number, opts: {
    page?: number
    limit?: number
    event?: string
    category?: ProductEventCategory | 'all'
  }): Promise<AdminUserEventsResponse> {
    await adminService.assertAdmin(adminUserId)

    const user = await userRepository.findById(targetUserId)

    if (!user)
      throw new AppError(404, ERROR_CODES.USER.NOT_FOUND, 'User not found')

    const [stream, topRaw] = await Promise.all([
      this.listAdminEvents(adminUserId, { ...opts, userId: targetUserId }),
      userEventRepository.getUserTopEvents(targetUserId, 8),
    ])

    return {
      ...stream,
      topEvents: topRaw.map((item) => {
        const info = getEventInfo(item.event)

        return {
          event: item.event,
          category: info.category,
          label: info.label,
          count: item.count,
        }
      }),
    }
  }
}

export const userEventService = new UserEventService()
