import { z } from 'zod'

export const GrammarRuleSchema = z.preprocess((val: unknown) => {
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

export const VocabItemSchema = z.preprocess((val: unknown) => {
  if (typeof val === 'string') {
    return { word: val, transcription: '', meaning: '', usageInContext: '' }
  }
  // Deprecated
  // Поддержка старых ключей (pinyin -> transcription, translation -> meaning)
  if (val && typeof val === 'object') {
    const obj = val as Record<string, unknown>
    return {
      word: obj.word || '',
      transcription: obj.transcription || obj.pinyin || '',
      meaning: obj.meaning || obj.translation || '',
      usageInContext: obj.usageInContext || '',
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

export const WordAutoFillResponseSchema = z.object({
  transcription: z.string(),
  translation: z.string(),
  difficulty: z.string(),
  tags: z.string(),
  grammarNote: z.string(),
  vocabularyNote: z.string(),
})

export const WordExampleSchema = z.object({
  type: z.string(),
  original: z.string(),
  transcription: z.string(),
  translation: z.string(),
  literal_translation: z.string(),
})

export const WordCollocationSchema = z.object({
  original: z.string(),
  transcription: z.string(),
  translation: z.string(),
})

export const WordRelationItemSchema = z.object({
  word: z.string(),
  transcription: z.string(),
  translation: z.string(),
})

export const WordRelationsSchema = z.object({
  synonyms: z.array(WordRelationItemSchema).optional(),
  antonyms: z.array(WordRelationItemSchema).optional(),
})

export const GeneratedWordExamplesSchema = z.object({
  word: z.string(),
  transcription: z.string(),
  main_translations: z.array(z.string()),
  vocabulary: z.array(VocabItemSchema).optional(),
  mnemonics: z.string().optional(),
  grammar_note: z.string().optional(),
  examples: z.array(WordExampleSchema).optional(),
  collocations: z.array(WordCollocationSchema).optional(),
  relations: WordRelationsSchema.optional(),
})

export const BookAnalysisResponseSchema = z.object({
  description: z.string(),
  difficulty: z.string(),
  tags: z.array(z.string()),
})

export const BatchAnalysisResponseSchema = z.array(z.object({
  id: z.string(),
  analysis: LlmAnalysisSchema,
}))

export const AnalyzeBatchSchema = z.object({
  items: z.array(z.object({
    id: z.string(),
    sentence: z.string().max(1000, 'Фраза слишком длинная (макс. 1000 символов)'),
    context: z.string().max(5000, 'Контекст слишком большой').optional(),
    type: z.enum(['sentence', 'word']).default('sentence'),
  })).max(20, 'Слишком большой пакет'),
  language: z.string(),
  targetLanguage: z.string().optional(),
})

export const CheckCacheSchema = z.object({
  items: z.array(z.object({
    text: z.string(),
    type: z.enum(['sentence', 'word']).default('sentence'),
  })).max(200, 'Слишком большой пакет'),
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
  publicStatus: z.enum(['private', 'pending', 'public', 'rejected']).optional(),
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
  context: z.string().max(5000, 'Контекст слишком большой').optional(),
  targetLanguage: z.string().optional(),
  type: z.enum(['sentence', 'word']).optional().default('sentence'),
})

export const GenerateTtsSchema = z.object({
  text: z.string()
    .min(1, 'Текст не передан')
    .max(600, 'Текст слишком длинный для озвучки'),
  voice: z.string().optional(),
  forceCacheBypass: z.boolean().optional(),
})

export const GenerateTtsStandaloneSchema = z.object({
  text: z.string()
    .min(1, 'Текст не передан')
    .max(600, 'Текст слишком длинный'),
  voice: z.string().optional(),
  forceCacheBypass: z.boolean().optional(),
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
  deckIds: z.array(z.number()).optional(),
  contextSentence: z.string().optional(),
  contextBookId: z.number().optional(),
})

export const SrsReviewSchema = z.object({
  wordId: z.number(),
  // 1: Again, 2: Hard, 3: Good, 4: Easy
  grade: z.number().min(1).max(4),
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
  deckIds: z.array(z.number()).optional(),
})

export const CatalogSchema = z.object({
  title: z.string().min(1),
  url: z.string().url(),
})

export const DeepDiveRequestSchema = z.object({
  word: z.string().min(1),
  language: z.string().min(1),
  mode: z.enum(['collocations', 'radicals']),
})

export const CreateHighlightSchema = z.object({
  bookId: z.coerce.number({ message: 'bookId обязателен' }),
  text: z.string().min(1, 'Текст выделения не может быть пустым'),
  translation: z.string().nullable().optional(),
  note: z.string().nullable().optional(),
  color: z.string().default('#fde047'),
  chapter: z.string().nullable().optional(),
  pageNum: z.coerce.number().int().min(1, 'Номер страницы должен быть больше 0'),
  analysisData: LlmAnalysisSchema.nullable().optional(),
})

export const UpdateHighlightSchema = z.object({
  translation: z.string().nullable().optional(),
  note: z.string().nullable().optional(),
  color: z.string().optional(),
  chapter: z.string().nullable().optional(),
  pageNum: z.coerce.number().int().min(1).optional(),
  analysisData: LlmAnalysisSchema.nullable().optional(),
})
