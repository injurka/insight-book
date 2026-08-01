import { z } from 'zod'
import { applyAcl } from '~/01.shared/lib/acl'
import { api } from '~/01.shared/services/api.service'
import { QuizLevelSchema, QuizQuestionsResponseSchema } from '~/01.shared/types/schemas/quiz.schema'

export interface IQuizRepository {
  getLevels: (lang: string) => Promise<any>
  generate: (lang: string, level: string) => Promise<any>
  submit: (lang: string, level: string, scorePct: number) => Promise<any>
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
