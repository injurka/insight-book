import type { LlmAnalysis } from '../models'
import { z } from 'zod'

// Главная схема хайлайта (ACL)
export const HighlightSchema = z.object({
  id: z.number(),
  userId: z.number(),
  bookId: z.number(),
  text: z.string().default(''),
  translation: z.string().nullable().default(null),
  note: z.string().nullable().default(null),
  color: z.string().default('yellow'),
  chapter: z.string().nullable().default(null),
  pageNum: z.coerce.number().default(0),
  // Сложный вложенный объект пропускаем как есть, но проверяем наличие
  analysisData: z.custom<LlmAnalysis>().nullish(),
  createdAt: z.string(),
})

export type HighlightDomain = z.infer<typeof HighlightSchema>
