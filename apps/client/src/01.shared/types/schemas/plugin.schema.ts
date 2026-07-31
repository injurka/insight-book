import { z } from 'zod'

// Схема установленного плагина пользователя (ACL)
export const UserPluginRecordSchema = z.object({
  userId: z.number(),
  pluginId: z.string(),
  manifestUrl: z.string(),
  settings: z.string().nullable().default(null),
  isEnabled: z.boolean().catch(true),
  createdAt: z.string().optional(),
})

export type UserPluginRecordDomain = z.infer<typeof UserPluginRecordSchema>
