import { z } from 'zod'

export const GrammarRuleSchema = z.preprocess((val: any) => {
  if (typeof val === 'string') {
    return {
      pattern: val,
      explanation: '',
      example: '',
    }
  }
  return val
}, z.object({
  pattern: z.string().catch(''),
  explanation: z.string().catch(''),
  example: z.string().catch(''),
}))

export const VocabItemSchema = z.preprocess((val: any) => {
  if (typeof val === 'string') {
    return { word: val, transcription: '', meaning: '', usageInContext: '' }
  }
  // Deprecated
  // Поддержка старых ключей (pinyin -> transcription, translation -> meaning)
  if (val && typeof val === 'object') {
    return {
      word: val.word || '',
      transcription: val.transcription || val.pinyin || '',
      meaning: val.meaning || val.translation || '',
      usageInContext: val.usageInContext || '',
    }
  }
  return val
}, z.object({
  word: z.string().catch(''),
  transcription: z.string().catch(''),
  meaning: z.string().catch(''),
  usageInContext: z.string().catch(''),
}))

export const LlmAnalysisSchema = z.object({
  transcription: z.string().catch(''),
  translation: z.string().catch(''),
  grammarRules: z.array(GrammarRuleSchema).default([]),
  vocabulary: z.array(VocabItemSchema).default([]),
})

export const AnalyzeBatchSchema = z.object({
  items: z.array(z.object({
    id: z.string(),
    sentence: z.string(),
    context: z.string().optional(),
  })).max(20, 'Слишком большой пакет'),
  language: z.string(),
})

export const UpdateBookSchema = z.object({
  title: z.string().optional(),
  author: z.string().nullable().optional(),
  coverUrl: z.string().nullable().optional(),
  language: z.string().optional(),
  createdAt: z.string().optional(),
  currentPage: z.number().optional(),
  series: z.string().nullable().optional(),
  seriesNumber: z.number().nullable().optional(),
  status: z.enum(['reading', 'to-read', 'have-read']).optional(),
  isFavorite: z.boolean().optional(),
  collection: z.string().nullable().optional(),
  isPublic: z.boolean().optional(),
  textDirection: z.string().nullable().optional(),
})

export const UpdateStatsSchema = z.object({
  description: z.string().optional(),
  difficulty: z.string().optional(),
  tags: z.array(z.string()).optional(),
})

export const AnalyzeSentenceSchema = z.object({
  sentence: z.string()
    .min(1, 'Предложение не может быть пустым')
    .max(600, 'Фраза слишком длинная для детального анализа (макс. 600 символов)'),
  language: z.string().min(1, 'Язык обязателен'),
})

export const GenerateTtsSchema = z.object({
  text: z.string()
    .min(1, 'Текст не передан')
    .max(600, 'Текст слишком длинный для озвучки'),
})

export const GenerateTtsStandaloneSchema = z.object({
  text: z.string()
    .min(1, 'Текст не передан')
    .max(600, 'Текст слишком длинный'),
  language: z.string().min(1, 'Язык обязателен'),
})

export const CreateCustomBookSchema = z.object({
  title: z.string().min(1, 'Название обязательно'),
  author: z.string().nullable().optional(),
  language: z.string().default('ja'),
  type: z.enum(['manga']).default('manga'),
})

export const UpsertUserDictSchema = z.object({
  word: z.string().min(1, 'Слово обязательно'),
  transcription: z.string().nullable().optional(),
  translation: z.string().nullable().optional(),
  language: z.string().min(1, 'Язык обязателен'),
  notes: z.string().nullable().optional(),
  tags: z.string().nullable().optional(),
  difficulty: z.string().nullable().optional(),
  grammarNote: z.string().nullable().optional(),
  vocabularyNote: z.string().nullable().optional(),
  deckId: z.number().nullable().optional(),
  contextSentence: z.string().optional(),
  contextBookId: z.number().optional(),
})

export const SrsReviewSchema = z.object({
  wordId: z.number(),
  grade: z.number().min(0).max(3),
})

export const DeckSchema = z.object({
  name: z.string().min(1, 'Название обязательно'),
  language: z.string().optional(),
})

export const GenerateExamplesSchema = z.object({
  word: z.string()
    .min(1, 'Слово обязательно')
    .max(100, 'Выделен слишком большой фрагмент текста (макс. 100 символов)'),
  language: z.string().min(1, 'Язык обязателен'),
})

export const BulkActionSchema = z.object({
  wordIds: z.array(z.number()),
  deckId: z.number().nullable().optional(),
})

export const CatalogSchema = z.object({
  title: z.string().min(1),
  url: z.string().url(),
})
