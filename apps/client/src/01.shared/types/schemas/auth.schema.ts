import { z } from 'zod'

// Схема данных пользователя (ACL)
export const UserDataSchema = z.object({
  id: z.number(),
  username: z.string().default(''),
  role: z.string().optional(),
  subscriptionTier: z.enum(['free', 'base', 'advanced', 'premium']).catch('free').optional(),
  usedTokens: z.number().optional(),
  tokenLimit: z.number().nullish(),
  usedBooks: z.number().optional(),
  bookLimit: z.number().nullish(),
  pushTargetDeckId: z.number().nullish(),
  pushTimeStart: z.string().optional(),
  pushTimeEnd: z.string().optional(),
  pushCount: z.number().optional(),
  timezone: z.string().optional(),
  uiLanguage: z.string().optional(),
  avatarUrl: z.string().nullish(),
})

// Схема ответа auth.me() (ACL)
export const AuthMeResponseSchema = z.object({
  user: UserDataSchema.nullable().default(null),
  mode: z.string().default('single'),
})

export type UserDataDomain = z.infer<typeof UserDataSchema>
export type AuthMeResponseDomain = z.infer<typeof AuthMeResponseSchema>
