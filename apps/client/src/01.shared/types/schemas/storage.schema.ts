import { z } from 'zod'

// Схема оценки использования хранилища (ACL)
export const StorageEstimateSchema = z.object({
  usage: z.number().default(0),
  quota: z.number().default(0),
})

export type StorageEstimateDomain = z.infer<typeof StorageEstimateSchema>
