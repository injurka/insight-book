import type { QuizLevelDomain } from '~/01.shared/types/schemas/quiz.schema'
import { z } from 'zod'
import { applyAcl } from '~/01.shared/lib/acl'
import { api } from '~/01.shared/services/api.service'
import { QuizLevelSchema, QuizQuestionsResponseSchema } from '~/01.shared/types/schemas/quiz.schema'

export type QuizQuestionsResponseDomain = z.infer<typeof QuizQuestionsResponseSchema>

export interface IQuizRepository {
  getLevels: (lang: string) => Promise<QuizLevelDomain[]>
  generate: (lang: string, level: string) => Promise<QuizQuestionsResponseDomain>
  submit: (lang: string, level: string, scorePct: number) => Promise<{ success: boolean, score: number, starsEarned: number, isPassed: boolean, nextLevelUnlocked: boolean, nextLevelValue: string | null }>
}

export class DefaultQuizRepository implements IQuizRepository {
  async getLevels(lang: string) {
    const raw = await api.quiz.getLevels(lang)

    return applyAcl(z.array(QuizLevelSchema), raw, 'quiz.getLevels()')
  }

  async generate(lang: string, level: string) {
    const raw = await api.quiz.generate(lang, level)

    return applyAcl(QuizQuestionsResponseSchema, raw, 'quiz.generate()')
  }

  async submit(lang: string, level: string, scorePct: number) { return api.quiz.submit(lang, level, scorePct) }
}

export const quizRepository: IQuizRepository = new DefaultQuizRepository()
