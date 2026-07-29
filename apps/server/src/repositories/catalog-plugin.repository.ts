import type { CatalogPluginStatus } from '../constants/catalog-plugin'
import { eq } from 'drizzle-orm'
import { db } from '../db'
import * as schema from '../db/schema'

export class CatalogPluginRepository {
  async findMany(status?: CatalogPluginStatus) {
    return db.query.catalogPlugins.findMany({
      where: status ? eq(schema.catalogPlugins.status, status) : undefined,
      orderBy: (t, { asc }) => [asc(t.name)],
    })
  }

  async findByUploader(userId: number) {
    return db.query.catalogPlugins.findMany({
      where: eq(schema.catalogPlugins.uploadedBy, userId),
      orderBy: (t, { asc }) => [asc(t.name)],
    })
  }

  async findOne(pluginId: string) {
    return db.query.catalogPlugins.findFirst({
      where: eq(schema.catalogPlugins.id, pluginId),
    })
  }

  async upsert(data: typeof schema.catalogPlugins.$inferInsert) {
    const existing = await this.findOne(data.id)
    if (existing) {
      const [updated] = await db.update(schema.catalogPlugins)
        .set({
          name: data.name,
          version: data.version,
          description: data.description ?? existing.description,
          icon: data.icon ?? existing.icon,
          author: data.author ?? existing.author,
          manifestUrl: data.manifestUrl,
          status: data.status ?? existing.status,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(schema.catalogPlugins.id, data.id))
        .returning()
      return updated
    }

    const [created] = await db.insert(schema.catalogPlugins).values(data).returning()
    return created
  }

  async updateStatus(pluginId: string, status: CatalogPluginStatus) {
    const [updated] = await db.update(schema.catalogPlugins)
      .set({ status, updatedAt: new Date().toISOString() })
      .where(eq(schema.catalogPlugins.id, pluginId))
      .returning()
    return updated ?? null
  }

  async delete(pluginId: string) {
    const deleted = await db.delete(schema.catalogPlugins)
      .where(eq(schema.catalogPlugins.id, pluginId))
      .returning()
    return deleted.length > 0
  }
}

export const catalogPluginRepository = new CatalogPluginRepository()
