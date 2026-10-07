import type { CatalogPluginStatus } from '../constants/catalog-plugin'
import { and, eq, sql } from 'drizzle-orm'
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
type CatalogPluginVersionRow = typeof schema.catalogPluginVersions.$inferSelect
type CatalogPluginVersionWithUploader = CatalogPluginVersionRow & {
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

function toVersionApiRecord(row: CatalogPluginVersionWithUploader): CatalogPluginApiRecord {
  return {
    id: row.pluginId,
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

const versionCollator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' })

function latestVersionPerPlugin(records: CatalogPluginApiRecord[]) {
  const latest = new Map<string, CatalogPluginApiRecord>()

  for (const record of records) {
    const current = latest.get(record.id)
    if (!current) {
      latest.set(record.id, record)
      continue
    }

    const updateTime = Date.parse(record.updatedAt) - Date.parse(current.updatedAt)
    if (updateTime > 0 || (updateTime === 0 && versionCollator.compare(record.version, current.version) > 0))
      latest.set(record.id, record)
  }

  return [...latest.values()].sort((left, right) => left.name.localeCompare(right.name))
}

export class CatalogPluginRepository {
  async findVersions(status?: CatalogPluginStatus) {
    const rows = await db.query.catalogPluginVersions.findMany({
      where: status ? eq(schema.catalogPluginVersions.status, status) : undefined,
      orderBy: (t, { asc }) => [asc(t.name), asc(t.pluginId)],
      with: {
        uploader: { columns: { username: true } },
      },
    })
    return rows.map(toVersionApiRecord)
  }

  async findLatestApprovedVersions() {
    return latestVersionPerPlugin(await this.findVersions('approved'))
  }

  async findLatestVersionsByUploader(userId: number) {
    const rows = await db.query.catalogPluginVersions.findMany({
      where: eq(schema.catalogPluginVersions.uploadedBy, userId),
      orderBy: (t, { desc }) => [desc(t.updatedAt)],
      with: {
        uploader: { columns: { username: true } },
      },
    })
    return latestVersionPerPlugin(rows.map(toVersionApiRecord))
  }

  async findVersion(pluginId: string, version: string) {
    const row = await db.query.catalogPluginVersions.findFirst({
      where: and(
        eq(schema.catalogPluginVersions.pluginId, pluginId),
        eq(schema.catalogPluginVersions.version, version),
      ),
      with: {
        uploader: { columns: { username: true } },
      },
    })
    return row ? toVersionApiRecord(row) : null
  }

  async saveVersion(data: typeof schema.catalogPluginVersions.$inferInsert) {
    const existing = await this.findVersion(data.pluginId, data.version)
    if (existing) {
      await db.update(schema.catalogPluginVersions)
        .set({
          name: data.name,
          description: data.description ?? null,
          icon: data.icon ?? null,
          author: data.author ?? null,
          sourceUrl: data.sourceUrl ?? null,
          manifestUrl: data.manifestUrl,
          uploadedBy: data.uploadedBy ?? existing.uploadedBy,
          status: 'pending',
          updatedAt: new Date().toISOString(),
        })
        .where(and(
          eq(schema.catalogPluginVersions.pluginId, data.pluginId),
          eq(schema.catalogPluginVersions.version, data.version),
        ))
    }
    else {
      await db.insert(schema.catalogPluginVersions).values(data)
    }

    return this.findVersion(data.pluginId, data.version)
  }

  async updateVersionStatus(pluginId: string, version: string, status: CatalogPluginStatus) {
    await db.update(schema.catalogPluginVersions)
      .set({ status, updatedAt: new Date().toISOString() })
      .where(and(
        eq(schema.catalogPluginVersions.pluginId, pluginId),
        eq(schema.catalogPluginVersions.version, version),
      ))

    return this.findVersion(pluginId, version)
  }

  async deleteVersions(pluginId: string) {
    await db.delete(schema.catalogPluginVersions)
      .where(eq(schema.catalogPluginVersions.pluginId, pluginId))
  }

  async deleteVersion(pluginId: string, version: string) {
    const deleted = await db.delete(schema.catalogPluginVersions)
      .where(and(
        eq(schema.catalogPluginVersions.pluginId, pluginId),
        eq(schema.catalogPluginVersions.version, version),
      ))
      .returning()
    return deleted.length > 0
  }

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
    await this.deleteVersions(pluginId)
    const deleted = await db.delete(schema.catalogPlugins)
      .where(eq(schema.catalogPlugins.id, pluginId))
      .returning()
    return deleted.length > 0
  }

  async countPending() {
    const result = await db.select({ count: sql<number>`count(*)` })
      .from(schema.catalogPluginVersions)
      .where(eq(schema.catalogPluginVersions.status, 'pending'))
      .get()
    return result?.count || 0
  }
}

export const catalogPluginRepository = new CatalogPluginRepository()
