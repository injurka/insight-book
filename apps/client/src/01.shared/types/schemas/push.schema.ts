import { z } from 'zod'

// Схема ответа с публичным VAPID-ключом (ACL)
export const VapidPublicKeyResponseSchema = z.object({
  publicKey: z.string(),
})

export type VapidPublicKeyResponseDomain = z.infer<typeof VapidPublicKeyResponseSchema>
