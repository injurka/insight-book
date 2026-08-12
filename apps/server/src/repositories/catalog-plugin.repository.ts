import type { CatalogPluginStatus } from '../constants/catalog-plugin'
import { eq, sql } from 'drizzle-orm'
import { db } from '../db'
import * as schema from '../db/schema'

/** Форма записи каталога, отдаваемая наружу: author резолвится из uploader.username */
export interface CatalogPluginApiRecord {
  id: string
  name: string
  version: string
  description: string | null
  icon: string | null
  author: string | null
  sourceUrl: string | null
  manifestUrl: string
  uploadedBy: number | null
  status: CatalogPluginStatus
  createdAt: string
  updatedAt: string
}

type CatalogPluginRow = typeof schema.catalogPlugins.$inferSelect
type CatalogPluginWithUploader = CatalogPluginRow & {
  uploader: { username: string } | null
}

/** Маппинг строки БД в API-форму: author = username загрузившего пользователя */
function toApiRecord(row: CatalogPluginWithUploader): CatalogPluginApiRecord {
  return {
    id: row.id,
    name: row.name,
    version: row.version,
    description: row.description,
    icon: row.icon,
    author: row.uploader?.username ?? row.author ?? null,
    sourceUrl: row.sourceUrl,
    manifestUrl: row.manifestUrl,
    uploadedBy: row.uploadedBy,
    status: row.status as CatalogPluginStatus,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

export class CatalogPluginRepository {
  async findMany(status?: CatalogPluginStatus) {
    const rows = await db.query.catalogPlugins.findMany({
      where: status ? eq(schema.catalogPlugins.status, status) : undefined,
      orderBy: (t, { asc }) => [asc(t.name)],
      with: {
        uploader: { columns: { username: true } },
      },
    })
    return rows.map(toApiRecord)
  }

  async findByUploader(userId: number) {
    const rows = await db.query.catalogPlugins.findMany({
      where: eq(schema.catalogPlugins.uploadedBy, userId),
      orderBy: (t, { asc }) => [asc(t.name)],
      with: {
        uploader: { columns: { username: true } },
      },
    })
    return rows.map(toApiRecord)
  }

  async findOne(pluginId: string) {
    const row = await db.query.catalogPlugins.findFirst({
      where: eq(schema.catalogPlugins.id, pluginId),
      with: {
        uploader: { columns: { username: true } },
      },
    })
    return row ? toApiRecord(row) : null
  }

  async upsert(data: typeof schema.catalogPlugins.$inferInsert) {
    const existing = await db.query.catalogPlugins.findFirst({
      where: eq(schema.catalogPlugins.id, data.id),
    })

    if (existing) {
      await db.update(schema.catalogPlugins)
        .set({
          name: data.name,
          version: data.version,
          description: data.description ?? existing.description,
          icon: data.icon ?? existing.icon,
          author: data.author ?? existing.author,
          sourceUrl: data.sourceUrl ?? existing.sourceUrl,
          manifestUrl: data.manifestUrl,
          status: data.status ?? existing.status,
          uploadedBy: data.uploadedBy ?? existing.uploadedBy,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(schema.catalogPlugins.id, data.id))
    }
    else {
      await db.insert(schema.catalogPlugins).values(data)
    }

    // Возвращаем маппленную запись с актуальным author
    return this.findOne(data.id)
  }

  async updateStatus(pluginId: string, status: CatalogPluginStatus) {
    const [updated] = await db.update(schema.catalogPlugins)
      .set({ status, updatedAt: new Date().toISOString() })
      .where(eq(schema.catalogPlugins.id, pluginId))
      .returning()
    if (!updated)
      return null

    return this.findOne(pluginId)
  }

  async delete(pluginId: string) {
    const deleted = await db.delete(schema.catalogPlugins)
      .where(eq(schema.catalogPlugins.id, pluginId))
      .returning()
    return deleted.length > 0
  }

  async countPending() {
    const result = await db.select({ count: sql<number>`count(*)` })
      .from(schema.catalogPlugins)
      .where(eq(schema.catalogPlugins.status, 'pending'))
      .get()
    return result?.count || 0
  }
}

export const catalogPluginRepository = new CatalogPluginRepository()
