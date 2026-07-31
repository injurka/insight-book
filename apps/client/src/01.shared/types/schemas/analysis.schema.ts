import { z } from 'zod'

// Вспомогательная схема грамматического правила
export const GrammarRuleSchema = z.object({
  pattern: z.string().default(''),
  explanation: z.string().default(''),
  example: z.string().default(''),
})

// Вспомогательная схема словарного элемента
export const VocabItemSchema = z.object({
  word: z.string().default(''),
  transcription: z.string().default(''),
  meaning: z.string().default(''),
  usageInContext: z.string().default(''),
})

// Главная схема LLM-анализа (ACL)
export const LlmAnalysisSchema = z.object({
  transcription: z.string().default(''),
  translation: z.string().default(''),
  grammarRules: z.array(GrammarRuleSchema).catch([]).default([]),
  vocabulary: z.array(VocabItemSchema).catch([]).default([]),
})

export type LlmAnalysisDomain = z.infer<typeof LlmAnalysisSchema>
