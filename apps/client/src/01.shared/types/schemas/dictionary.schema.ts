import { z } from 'zod'

// Вспомогательная схема встречаемости слова
export const WordEncounterSchema = z.object({
  id: z.number(),
  wordId: z.number(),
  bookId: z.number().nullable().default(null),
  sentence: z.string().default(''),
  createdAt: z.string(),
  bookTitle: z.string().optional(),
  book: z.object({ title: z.string().default('') }).optional(),
})

// Главная схема слова пользовательского словаря (ACL)
export const UserDictItemSchema = z.object({
  id: z.number(),
  deckIds: z.array(z.number()).default([]),
  word: z.string().default(''),
  transcription: z.string().nullable().default(null),
  translation: z.string().nullable().default(null),
  language: z.string().default('en'),
  targetLanguage: z.string().default('ru'),
  notes: z.string().nullable().default(null),
  tags: z.string().nullable().default(null),
  difficulty: z.string().nullable().default(null),
  grammarNote: z.string().nullable().default(null),
  vocabularyNote: z.string().nullable().default(null),

  // FSRS Fields
  state: z.number().default(0),
  due: z.string(),
  stability: z.number().default(0),
  difficultyFsrs: z.number().default(0),
  scheduledDays: z.number().default(0),
  reps: z.number().default(0),
  lapses: z.number().default(0),
  lastReview: z.string().nullable().default(null),
  learningSteps: z.number().default(0),

  createdAt: z.string(),
  updatedAt: z.string(),

  encounters: z.array(WordEncounterSchema).optional(),
})

// Схема колоды словаря (ACL)
export const DictDeckSchema = z.object({
  id: z.number(),
  userId: z.number(),
  name: z.string().default(''),
  language: z.string().default('en'),
  targetLanguage: z.string().default('ru'),
  createdAt: z.string(),
})

// Схема колоды каталога (ACL)
export const CatalogDeckSchema = z.object({
  id: z.number(),
  name: z.string().default(''),
  language: z.string().default('en'),
  targetLanguage: z.string().default('ru'),
  wordCount: z.number().default(0),
  description: z.string().optional(),
  author: z.string().optional(),
  difficulty: z.string().optional(),
})

// Схема слова каталога (ACL)
export const CatalogWordSchema = z.object({
  id: z.number(),
  word: z.string().default(''),
  translation: z.string().optional(),
  transcription: z.string().optional(),
})

// Схема пользовательского промпта (ACL)
export const PromptItemSchema = z.object({
  id: z.number(),
  name: z.string().default(''),
  prompt: z.string().default(''),
  userId: z.number().optional(),
})

export type UserDictItemDomain = z.infer<typeof UserDictItemSchema>
export type DictDeckDomain = z.infer<typeof DictDeckSchema>
export type CatalogDeckDomain = z.infer<typeof CatalogDeckSchema>
export type CatalogWordDomain = z.infer<typeof CatalogWordSchema>
export type PromptItemDomain = z.infer<typeof PromptItemSchema>
