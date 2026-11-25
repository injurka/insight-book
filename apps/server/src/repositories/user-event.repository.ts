import type { SQL } from 'drizzle-orm'
import type { EventMetaRecord } from '../constants/product-events'
import { and, asc, desc, eq, gte, inArray, lt, sql } from 'drizzle-orm'
import { db } from '../db'
import * as schema from '../db/schema'

export interface InsertUserEventRow {
  userId: number
  event: string
  meta: EventMetaRecord | null
  createdAt: string
}

export interface RawEventBreakdownRow {
  event: string
  totalCount: number
  uniqueUsers: number
}

export interface RawEventFunnelRow {
  userId: number
  event: string
  createdAt: string
}

export interface RawEventFeedRow {
  id: number
  userId: number
  username: string
  avatarUrl: string | null
  event: string
  meta: EventMetaRecord | null
  createdAt: string
}

export class UserEventRepository {
  async insertBatch(rows: InsertUserEventRow[], latestActiveIso: string): Promise<void> {
    if (rows.length === 0)
      return

    const uniqueUserIds = Array.from(new Set(rows.map(r => r.userId)))

    await Promise.all([
      db.insert(schema.userEvents).values(rows),
      uniqueUserIds.length === 1
        ? db.update(schema.users).set({ lastActiveAt: latestActiveIso }).where(eq(schema.users.id, uniqueUserIds[0]))
        : db.update(schema.users).set({ lastActiveAt: latestActiveIso }).where(inArray(schema.users.id, uniqueUserIds)),
    ])
  }

  async deleteOlderThan(cutoffIso: string): Promise<number> {
    const deleted = await db
      .delete(schema.userEvents)
      .where(lt(schema.userEvents.createdAt, cutoffIso))
      .returning({ id: schema.userEvents.id })

    return deleted.length
  }

  async countAll(): Promise<number> {
    const row = await db
      .select({ count: sql<number>`count(*)`.mapWith(Number) })
      .from(schema.userEvents)
      .get()

    return row?.count ?? 0
  }

  async countDistinctUsersSince(sinceIso: string): Promise<number> {
    const row = await db
      .select({ count: sql<number>`COUNT(DISTINCT ${schema.userEvents.userId})`.mapWith(Number) })
      .from(schema.userEvents)
      .where(gte(schema.userEvents.createdAt, sinceIso))
      .get()

    return row?.count ?? 0
  }

  async getBreakdownSince(sinceIso: string): Promise<RawEventBreakdownRow[]> {
    return db
      .select({
        event: schema.userEvents.event,
        totalCount: sql<number>`count(*)`.mapWith(Number),
        uniqueUsers: sql<number>`COUNT(DISTINCT ${schema.userEvents.userId})`.mapWith(Number),
      })
      .from(schema.userEvents)
      .where(gte(schema.userEvents.createdAt, sinceIso))
      .groupBy(schema.userEvents.event)
      .orderBy(desc(sql`count(*)`))
  }

  async getDistinctUsersByEventsSince(sinceIso: string, events: string[]): Promise<number> {
    if (events.length === 0)
      return 0

    const row = await db
      .select({ count: sql<number>`COUNT(DISTINCT ${schema.userEvents.userId})`.mapWith(Number) })
      .from(schema.userEvents)
      .where(and(gte(schema.userEvents.createdAt, sinceIso), inArray(schema.userEvents.event, events)))
      .get()

    return row?.count ?? 0
  }

  async getFunnelRowsSince(sinceIso: string, events: string[]): Promise<RawEventFunnelRow[]> {
    if (events.length === 0)
      return []

    return db
      .select({
        userId: schema.userEvents.userId,
        event: schema.userEvents.event,
        createdAt: schema.userEvents.createdAt,
      })
      .from(schema.userEvents)
      .where(and(gte(schema.userEvents.createdAt, sinceIso), inArray(schema.userEvents.event, events)))
      .orderBy(asc(schema.userEvents.userId), asc(schema.userEvents.createdAt), asc(schema.userEvents.id))
  }

  async listEvents(opts: {
    userId?: number
    events?: string[]
    limit: number
    offset: number
  }): Promise<{ rows: RawEventFeedRow[], total: number }> {
    const conditions: SQL[] = []

    if (opts.userId !== undefined)
      conditions.push(eq(schema.userEvents.userId, opts.userId))

    if (opts.events && opts.events.length > 0)
      conditions.push(inArray(schema.userEvents.event, opts.events))

    const where = conditions.length > 0 ? and(...conditions) : undefined

    const [rows, totalRow] = await Promise.all([
      db
        .select({
          id: schema.userEvents.id,
          userId: schema.userEvents.userId,
          username: schema.users.username,
          avatarUrl: schema.users.avatarUrl,
          event: schema.userEvents.event,
          meta: schema.userEvents.meta,
          createdAt: schema.userEvents.createdAt,
        })
        .from(schema.userEvents)
        .innerJoin(schema.users, eq(schema.userEvents.userId, schema.users.id))
        .where(where)
        .orderBy(desc(schema.userEvents.createdAt), desc(schema.userEvents.id))
        .limit(opts.limit)
        .offset(opts.offset),
      db
        .select({ count: sql<number>`count(*)`.mapWith(Number) })
        .from(schema.userEvents)
        .where(where)
        .get(),
    ])

    return {
      rows,
      total: totalRow?.count ?? 0,
    }
  }

  async getUserTopEvents(userId: number, limit: number = 8): Promise<Array<{ event: string, count: number }>> {
    return db
      .select({
        event: schema.userEvents.event,
        count: sql<number>`count(*)`.mapWith(Number),
      })
      .from(schema.userEvents)
      .where(eq(schema.userEvents.userId, userId))
      .groupBy(schema.userEvents.event)
      .orderBy(desc(sql`count(*)`))
      .limit(limit)
  }
}

export const userEventRepository = new UserEventRepository()
