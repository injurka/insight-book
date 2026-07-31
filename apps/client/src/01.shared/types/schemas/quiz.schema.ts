import { z } from 'zod'

// Схема уровня квиза (ACL)
export const QuizLevelSchema = z.object({
  id: z.number(),
  language: z.string().default('en'),
  levelValue: z.string().default(''),
  bestScore: z.number().default(0),
  stars: z.number().default(0),
  unlocked: z.boolean().catch(false),
})

// Вспомогательная схема вопроса квиза
export const QuizQuestionSchema = z.object({
  type: z.enum(['choice', 'cloze', 'reorder']).catch('choice'),
  question: z.string().default(''),
  options: z.array(z.string()).default([]),
  correctAnswer: z.string().default(''),
  explanation: z.string().default(''),
})

// Схема ответа генерации квиза (ACL)
export const QuizQuestionsResponseSchema = z.object({
  questions: z.array(QuizQuestionSchema).default([]),
  cached: z.boolean().catch(false),
})

export type QuizLevelDomain = z.infer<typeof QuizLevelSchema>
export type QuizQuestionDomain = z.infer<typeof QuizQuestionSchema>
