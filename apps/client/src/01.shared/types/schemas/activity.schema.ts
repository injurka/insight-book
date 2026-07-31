import { z } from 'zod'

// Схема статистики активности (ACL)
export const ActivityStatsSchema = z.object({
  heatmap: z.array(z.object({
    date: z.string(),
    count: z.number().default(0),
  })).default([]),
  learnedWords: z.number().default(0),
  readPages: z.number().default(0),
  difficulties: z.array(z.object({
    language: z.string().default('en'),
    difficulty: z.string().default(''),
    count: z.number().default(0),
  })).default([]),
  quizProgress: z.array(z.object({
    language: z.string().default('en'),
    levelValue: z.string().default(''),
    bestScore: z.number().default(0),
    stars: z.number().default(0),
    unlocked: z.boolean().catch(false),
  })).optional(),
})

// Схема статистики расхода токенов (ACL)
export const ActivityTokensSchema = z.object({
  stats: z.array(z.object({
    action: z.string().default(''),
    inputTokens: z.number().default(0),
    outputTokens: z.number().default(0),
    cost: z.number().default(0),
  })).default([]),
  daily: z.array(z.object({
    date: z.string(),
    inputTokens: z.number().default(0),
    outputTokens: z.number().default(0),
    cost: z.number().optional(),
  })).default([]),
  totalCost: z.number().default(0),
})

export type ActivityStatsDomain = z.infer<typeof ActivityStatsSchema>
export type ActivityTokensDomain = z.infer<typeof ActivityTokensSchema>
