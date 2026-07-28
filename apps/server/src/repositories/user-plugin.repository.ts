import { and, eq } from 'drizzle-orm'
import { db } from '../db'
import * as schema from '../db/schema'

export class UserPluginRepository {
  async findMany(userId: number) {
    return db.query.userPlugins.findMany({
      where: eq(schema.userPlugins.userId, userId),
    })
  }

  async findOne(userId: number, pluginId: string) {
    return db.query.userPlugins.findFirst({
      where: and(
        eq(schema.userPlugins.userId, userId),
        eq(schema.userPlugins.pluginId, pluginId),
      ),
    })
  }

  async upsert(data: typeof schema.userPlugins.$inferInsert) {
    const existing = await this.findOne(data.userId, data.pluginId)
    if (existing) {
      const [updated] = await db.update(schema.userPlugins)
        .set({
          manifestUrl: data.manifestUrl,
          settings: data.settings ?? existing.settings,
          isEnabled: data.isEnabled ?? existing.isEnabled,
        })
        .where(and(
          eq(schema.userPlugins.userId, data.userId),
          eq(schema.userPlugins.pluginId, data.pluginId),
        ))
        .returning()
      return updated
    }

    const [created] = await db.insert(schema.userPlugins).values(data).returning()
    return created
  }

  async update(userId: number, pluginId: string, data: Partial<typeof schema.userPlugins.$inferInsert>) {
    const [updated] = await db.update(schema.userPlugins)
      .set(data)
      .where(and(
        eq(schema.userPlugins.userId, userId),
        eq(schema.userPlugins.pluginId, pluginId),
      ))
      .returning()
    return updated
  }

  async delete(userId: number, pluginId: string) {
    const deleted = await db.delete(schema.userPlugins)
      .where(and(
        eq(schema.userPlugins.userId, userId),
        eq(schema.userPlugins.pluginId, pluginId),
      ))
      .returning()
    return deleted.length > 0
  }
}

export const userPluginRepository = new UserPluginRepository()
