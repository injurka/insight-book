import { z } from 'zod'

// Схема тарифа подписки (ACL) — локализованный ответ публичного API
export const SubscriptionTierSchema = z.object({
  id: z.string(),
  icon: z.string().default('mdi:star'),
  badge: z.string().default(''),
  name: z.string().default(''),
  price: z.number().default(0),
  dailyTokenLimit: z.number().nullable().default(null),
  dailyBookLimit: z.number().nullable().default(null),
  description: z.string().default(''),
  features: z.array(z.string()).default([]),
  isPopular: z.boolean().default(false),
  gradient: z.string().default(''),
  accentColor: z.string().default('#94a3b8'),
})

export type SubscriptionTierDomain = z.infer<typeof SubscriptionTierSchema>
