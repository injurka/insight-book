import type { SubscriptionLang } from '../constants/subscription-tiers-seed'
import { eq, sql } from 'drizzle-orm'
import { ERROR_CODES } from '../constants/error-codes'
import {
  SUBSCRIPTION_LANGS,
  SUBSCRIPTION_TIERS_SEED,
} from '../constants/subscription-tiers-seed'
import { db } from '../db'
import * as schema from '../db/schema'
import { AppError } from '../utils/errors'
import { logger } from '../utils/logger'

export type SubscriptionTierRow = typeof schema.subscriptionTiers.$inferSelect
export type SubscriptionTierInsert = typeof schema.subscriptionTiers.$inferInsert

/** Поля тарифа, которые редактирует админ (все языки + нелокализуемые). */
export interface SubscriptionTierInput {
  id?: string
  sortOrder?: number
  icon?: string
  price?: number
  dailyTokenLimit?: number | null
  dailyBookLimit?: number | null
  isPopular?: boolean
  gradient?: string
  accentColor?: string
  badgeEn?: string
  badgeRu?: string
  badgeZh?: string
  nameEn?: string
  nameRu?: string
  nameZh?: string
  descriptionEn?: string
  descriptionRu?: string
  descriptionZh?: string
  featuresEn?: string[]
  featuresRu?: string[]
  featuresZh?: string[]
}

function pickLocalized<T>(en: T, ru: T, zh: T, lang: SubscriptionLang): T {
  if (lang === 'en')
    return en
  if (lang === 'ru')
    return ru
  return zh
}

function toInsert(seed: typeof SUBSCRIPTION_TIERS_SEED[number]): SubscriptionTierInsert {
  return {
    id: seed.id,
    sortOrder: seed.sortOrder,
    icon: seed.icon,
    price: seed.price,
    dailyTokenLimit: seed.dailyTokenLimit,
    dailyBookLimit: seed.dailyBookLimit,
    isPopular: seed.isPopular,
    gradient: seed.gradient,
    accentColor: seed.accentColor,
    badgeEn: seed.badge.en,
    badgeRu: seed.badge.ru,
    badgeZh: seed.badge.zh,
    nameEn: seed.name.en,
    nameRu: seed.name.ru,
    nameZh: seed.name.zh,
    descriptionEn: seed.description.en,
    descriptionRu: seed.description.ru,
    descriptionZh: seed.description.zh,
    featuresEn: seed.features.en,
    featuresRu: seed.features.ru,
    featuresZh: seed.features.zh,
  }
}

export class SubscriptionTierService {
  /** Первичное заполнение таблицы дефолтными тарифами (вызывается из db/index.ts). */
  async seedIfEmpty(): Promise<void> {
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(schema.subscriptionTiers)

    if (Number(count) > 0)
      return

    await db.insert(schema.subscriptionTiers).values(SUBSCRIPTION_TIERS_SEED.map(toInsert))
    logger.info(`✅ Seeded ${SUBSCRIPTION_TIERS_SEED.length} subscription tiers`)
  }

  /** Полный список тарифов (все языки) — для админки. */
  async list(): Promise<SubscriptionTierRow[]> {
    return db.query.subscriptionTiers.findMany({
      orderBy: (t, { asc }) => [asc(t.sortOrder), asc(t.id)],
    })
  }

  /** Локализованный список тарифов — для публичного API. */
  async listLocalized(lang: SubscriptionLang): Promise<Array<{
    id: string
    icon: string
    badge: string
    name: string
    price: number
    dailyTokenLimit: number | null
    dailyBookLimit: number | null
    description: string
    features: string[]
    isPopular: boolean
    gradient: string
    accentColor: string
  }>> {
    const rows = await this.list()

    return rows.map(r => ({
      id: r.id,
      icon: r.icon,
      badge: pickLocalized(r.badgeEn, r.badgeRu, r.badgeZh, lang),
      name: pickLocalized(r.nameEn, r.nameRu, r.nameZh, lang),
      price: r.price,
      dailyTokenLimit: r.dailyTokenLimit,
      dailyBookLimit: r.dailyBookLimit,
      description: pickLocalized(r.descriptionEn, r.descriptionRu, r.descriptionZh, lang),
      features: pickLocalized(r.featuresEn, r.featuresRu, r.featuresZh, lang),
      isPopular: r.isPopular,
      gradient: r.gradient,
      accentColor: r.accentColor,
    }))
  }

  async findById(id: string): Promise<SubscriptionTierRow | undefined> {
    return db.query.subscriptionTiers.findFirst({
      where: eq(schema.subscriptionTiers.id, id),
    })
  }

  async create(data: SubscriptionTierInput): Promise<SubscriptionTierRow> {
    const id = data.id?.trim()
    if (!id) {
      throw new AppError(400, ERROR_CODES.SYSTEM.VALIDATION_ERROR, 'Tier id is required')
    }

    const existing = await this.findById(id)
    if (existing) {
      throw new AppError(400, ERROR_CODES.SUBSCRIPTION.TIER_EXISTS, `Tier "${id}" already exists`)
    }

    const row = await db.insert(schema.subscriptionTiers).values({
      id,
      sortOrder: data.sortOrder ?? 0,
      icon: data.icon ?? 'mdi:star',
      price: data.price ?? 0,
      dailyTokenLimit: data.dailyTokenLimit ?? null,
      dailyBookLimit: data.dailyBookLimit ?? null,
      isPopular: data.isPopular ?? false,
      gradient: data.gradient ?? 'linear-gradient(135deg, rgba(148, 163, 184, 0.12), rgba(71, 85, 105, 0.04))',
      accentColor: data.accentColor ?? '#94a3b8',
      badgeEn: data.badgeEn ?? '',
      badgeRu: data.badgeRu ?? '',
      badgeZh: data.badgeZh ?? '',
      nameEn: data.nameEn ?? '',
      nameRu: data.nameRu ?? '',
      nameZh: data.nameZh ?? '',
      descriptionEn: data.descriptionEn ?? '',
      descriptionRu: data.descriptionRu ?? '',
      descriptionZh: data.descriptionZh ?? '',
      featuresEn: data.featuresEn ?? [],
      featuresRu: data.featuresRu ?? [],
      featuresZh: data.featuresZh ?? [],
    }).returning()

    logger.info(`[Subscription] Tier "${id}" created`)
    return row[0]
  }

  async update(id: string, data: SubscriptionTierInput): Promise<SubscriptionTierRow> {
    const existing = await this.findById(id)
    if (!existing) {
      throw new AppError(404, ERROR_CODES.SUBSCRIPTION.TIER_NOT_FOUND, `Tier "${id}" not found`)
    }

    const updateData: Record<string, unknown> = {}

    const fields: Array<[keyof SubscriptionTierInput, keyof SubscriptionTierInput]> = [
      ['sortOrder', 'sortOrder'],
      ['icon', 'icon'],
      ['price', 'price'],
      ['dailyTokenLimit', 'dailyTokenLimit'],
      ['dailyBookLimit', 'dailyBookLimit'],
      ['isPopular', 'isPopular'],
      ['gradient', 'gradient'],
      ['accentColor', 'accentColor'],
      ['badgeEn', 'badgeEn'],
      ['badgeRu', 'badgeRu'],
      ['badgeZh', 'badgeZh'],
      ['nameEn', 'nameEn'],
      ['nameRu', 'nameRu'],
      ['nameZh', 'nameZh'],
      ['descriptionEn', 'descriptionEn'],
      ['descriptionRu', 'descriptionRu'],
      ['descriptionZh', 'descriptionZh'],
      ['featuresEn', 'featuresEn'],
      ['featuresRu', 'featuresRu'],
      ['featuresZh', 'featuresZh'],
    ]

    for (const [inputKey, dbKey] of fields) {
      if (data[inputKey] !== undefined)
        updateData[dbKey] = data[inputKey]
    }

    if (Object.keys(updateData).length === 0) {
      throw new AppError(400, ERROR_CODES.SYSTEM.NO_DATA_TO_UPDATE, 'No data to update')
    }

    updateData.updatedAt = sql`(datetime('now'))`

    await db.update(schema.subscriptionTiers)
      .set(updateData)
      .where(eq(schema.subscriptionTiers.id, id))

    logger.info(`[Subscription] Tier "${id}" updated: ${Object.keys(updateData).join(', ')}`)

    const updated = await this.findById(id)
    if (!updated) {
      throw new AppError(404, ERROR_CODES.SUBSCRIPTION.TIER_NOT_FOUND, `Tier "${id}" not found`)
    }
    return updated
  }

  async remove(id: string): Promise<void> {
    const existing = await this.findById(id)
    if (!existing) {
      throw new AppError(404, ERROR_CODES.SUBSCRIPTION.TIER_NOT_FOUND, `Tier "${id}" not found`)
    }

    if (id === 'free') {
      throw new AppError(400, ERROR_CODES.SUBSCRIPTION.CANNOT_DELETE_FREE, 'The "free" tier cannot be deleted')
    }

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(schema.users)
      .where(eq(schema.users.subscriptionTier, id))

    if (Number(count) > 0) {
      throw new AppError(
        400,
        ERROR_CODES.SUBSCRIPTION.TIER_IN_USE,
        `Cannot delete tier "${id}": ${count} user(s) have it assigned`,
      )
    }

    await db.delete(schema.subscriptionTiers).where(eq(schema.subscriptionTiers.id, id))
    logger.info(`[Subscription] Tier "${id}" deleted`)
  }
}

export const subscriptionTierService = new SubscriptionTierService()

export { SUBSCRIPTION_LANGS }
export type { SubscriptionLang }
