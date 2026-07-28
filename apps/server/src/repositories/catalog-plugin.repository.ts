import { eq } from 'drizzle-orm'
import { db } from '../db'
import * as schema from '../db/schema'

export class CatalogPluginRepository {
  async findMany() {
    return db.query.catalogPlugins.findMany({
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
          updatedAt: new Date().toISOString(),
        })
        .where(eq(schema.catalogPlugins.id, data.id))
        .returning()
      return updated
    }

    const [created] = await db.insert(schema.catalogPlugins).values(data).returning()
    return created
  }

  async delete(pluginId: string) {
    const deleted = await db.delete(schema.catalogPlugins)
      .where(eq(schema.catalogPlugins.id, pluginId))
      .returning()
    return deleted.length > 0
  }
}

export const catalogPluginRepository = new CatalogPluginRepository()
