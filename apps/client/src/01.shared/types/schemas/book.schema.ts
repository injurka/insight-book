import type { BookStats } from '../models'
import { z } from 'zod'

// Вспомогательная схема для оглавления
export const TocItemSchema = z.object({
  id: z.string(),
  href: z.string().default(''),
  title: z.string().default('Unknown'),
  order: z.number().default(0),
  level: z.number().default(1),
  pageNum: z.number().optional(),
})

// Главная схема книги (ACL)
export const BookSchema = z.object({
  id: z.number(),
  title: z.string().nullable().transform(val => val || 'Без названия'),
  author: z.string().nullable().default(null),
  coverUrl: z.string().nullable().default(null),
  localCoverUrl: z.string().optional(),
  filePath: z.string().default(''),
  language: z.string().default('en'),
  totalPages: z.number().default(1),
  currentPage: z.coerce.number().nullable().default(1),
  createdAt: z.string(),
  updatedAt: z.string().optional(),
  userId: z.number().optional(),
  type: z.string().optional(),
  toc: z.preprocess((val) => {
    if (typeof val === 'string') {
      try {
        return JSON.parse(val)
      }
      catch {
        return []
      }
    }

    return val
  }, z.array(TocItemSchema)).optional(),

  stats: z.custom<BookStats>().nullish(),
  series: z.string().nullish(),
  seriesNumber: z.number().nullish(),
  collection: z.string().nullish(),
  isPublic: z.boolean().optional(),
  publicStatus: z.enum(['private', 'pending', 'public', 'rejected']).catch('private').optional(),
  textDirection: z.string().nullish(),
  progressUpdatedAt: z.string().nullish(),
  analysesCount: z.number().optional(),
  cachedSentences: z.number().optional(),
  cachedWords: z.number().optional(),
  cachedTts: z.number().optional(),

  status: z.string().catch('reading').optional(),
  isFavorite: z.boolean().catch(false).optional(),

  processStatus: z.enum(['processing', 'ready', 'error']).optional(),
  processError: z.string().nullish(),
})

export type BookDomain = z.infer<typeof BookSchema>
