import { z } from 'zod'

export const BookDeckContentSchema = z.object({
  translation: z.string(),
  transcription: z.string(),
  difficulty: z.string(),
  tags: z.string(),
  grammarNote: z.string(),
  vocabularyNote: z.string(),
})
export const BookDeckWordSchema = z.object({
  word: z.string(),
  count: z.number(),
  forms: z.array(z.string()),
  pos: z.string().optional(),
  properName: z.boolean(),
  contexts: z.array(z.object({ sentence: z.string(), page: z.number() })),
  source: z.enum(['dictionary', 'cache', 'missing', 'generated']),
  dictionaryId: z.number().optional(),
  content: BookDeckContentSchema.nullable(),
})
export const BookDeckDraftSchema = z.object({
  id: z.string(),
  bookId: z.number(),
  name: z.string(),
  language: z.string(),
  targetLanguage: z.string(),
  words: z.array(BookDeckWordSchema),
  deckId: z.number().nullable(),
})
export type BookDeckWord = z.infer<typeof BookDeckWordSchema>
export type BookDeckDraft = z.infer<typeof BookDeckDraftSchema>
