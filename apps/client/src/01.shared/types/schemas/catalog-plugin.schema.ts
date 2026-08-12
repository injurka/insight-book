import { z } from 'zod'

// Схема записи каталога плагинов (ACL)
export const CatalogPluginRecordSchema = z.object({
  id: z.number(),
  name: z.string().default(''),
  version: z.string().default(''),
  description: z.string().nullable().default(null),
  icon: z.string().nullable().default(null),
  author: z.string().nullable().default(null),
  sourceUrl: z.string().nullable().default(null),
  manifestUrl: z.string(),
  status: z.enum(['pending', 'approved', 'rejected']).catch('pending'),
  uploadedBy: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export type CatalogPluginRecordDomain = z.infer<typeof CatalogPluginRecordSchema>
