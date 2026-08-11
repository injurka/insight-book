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

const coerceBoolean = z.preprocess((val) => {
  if (typeof val === 'number')
    return val !== 0
  if (typeof val === 'string')
    return val === 'true' || val === '1'

  return val
}, z.boolean())

// Главная схема книги (ACL)
export const BookSchema = z.object({
  id: z.coerce.number(),
  title: z.preprocess(val => (val === null || val === undefined ? 'Без названия' : String(val)), z.string().default('Без названия')),
  author: z.string().nullable().optional().default(null),
  coverUrl: z.string().nullable().optional().default(null),
  localCoverUrl: z.string().optional(),
  filePath: z.preprocess(val => (val === null || val === undefined ? '' : String(val)), z.string().default('')),
  language: z.preprocess(val => (val === null || val === undefined ? 'en' : String(val)), z.string().default('en')),
  totalPages: z.preprocess(val => (val === null || val === undefined ? 1 : Number(val)), z.coerce.number().default(1)),
  currentPage: z.coerce.number().nullable().optional().default(1),
  createdAt: z.preprocess(val => (val ? String(val) : new Date().toISOString()), z.string()),
  updatedAt: z.preprocess(val => (val === null ? undefined : val), z.string().optional()),
  userId: z.coerce.number().optional(),
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
  seriesNumber: z.coerce.number().nullish(),
  collection: z.string().nullish(),
  isPublic: coerceBoolean.catch(false).optional(),
  publicStatus: z.enum(['private', 'pending', 'public', 'rejected']).catch('private').optional(),
  textDirection: z.string().nullish(),
  progressUpdatedAt: z.string().nullish(),
  analysesCount: z.coerce.number().optional(),
  cachedSentences: z.coerce.number().optional(),
  cachedWords: z.coerce.number().optional(),
  cachedTts: z.coerce.number().optional(),

  status: z.string().catch('reading').optional(),
  isFavorite: coerceBoolean.catch(false).optional(),

  processStatus: z.enum(['processing', 'ready', 'error']).catch('ready').optional(),
  processError: z.string().nullish(),
})

export type BookDomain = z.infer<typeof BookSchema>
