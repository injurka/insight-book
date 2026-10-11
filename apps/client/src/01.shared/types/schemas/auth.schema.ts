import { z } from 'zod'

// Схема данных пользователя (ACL)
export const UserDataSchema = z.object({
  id: z.number(),
  username: z.string().default(''),
  email: z.string().nullish(),
  yandexId: z.string().nullish(),
  isYandexLinked: z.boolean().optional(),
  hasPassword: z.boolean().optional(),
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
  avatarUrl: z.string().nullish().transform(v => v ?? undefined),
})

// Схема ответа auth.me() (ACL)
export const AuthMeResponseSchema = z.object({
  user: UserDataSchema.nullable().default(null),
  mode: z.string().default('single'),
})

export const AuthOAuthStatusSchema = z.object({
  status: z.enum(['pending', 'success', 'error']),
  token: z.string().optional(),
  accessToken: z.string().optional(),
  refreshToken: z.string().optional(),
  expiresIn: z.number().positive().optional(),
  linked: z.boolean().optional(),
  error: z.string().optional(),
})

export const AuthSessionSchema = z.object({
  accessToken: z.string().min(1),
  refreshToken: z.string().min(20),
  expiresIn: z.number().positive(),
})

export const AuthLoginResponseSchema = z.object({
  token: z.string().optional(),
  accessToken: z.string().optional(),
  refreshToken: z.string().optional(),
  expiresIn: z.number().positive().optional(),
  user: UserDataSchema,
}).refine(value => !!value.token || !!value.accessToken, 'Missing access token')

export type AuthSessionDomain = z.infer<typeof AuthSessionSchema>
export type AuthLoginResponseDomain = z.infer<typeof AuthLoginResponseSchema>

export type UserDataDomain = z.infer<typeof UserDataSchema>
export type AuthMeResponseDomain = z.infer<typeof AuthMeResponseSchema>
export type AuthOAuthStatusDomain = z.infer<typeof AuthOAuthStatusSchema>
