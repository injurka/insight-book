import { api } from '~/01.shared/services/api.service'

export interface IQuizRepository {
  getLevels: (lang: string) => Promise<any>
  generate: (lang: string, level: string) => Promise<any>
  submit: (lang: string, level: string, scorePct: number) => Promise<any>
}

export class DefaultQuizRepository implements IQuizRepository {
  async getLevels(lang: string) { return await api.quiz.getLevels(lang) }
  async generate(lang: string, level: string) { return await api.quiz.generate(lang, level) }
  async submit(lang: string, level: string, scorePct: number) { return await api.quiz.submit(lang, level, scorePct) }
}

export const quizRepository: IQuizRepository = new DefaultQuizRepository()
