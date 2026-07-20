import { Elysia, t } from 'elysia'
import jwt from 'jsonwebtoken'
import { AUTH_MODE, JWT_SECRET } from '../config'
import { quizService } from '../services/quiz.service'
import { AppError } from '../utils/errors'
import { extractLlmConfig, normalizeLanguageCode } from '../utils/helpers'

const authPlugin = new Elysia().derive({ as: 'scoped' }, ({ headers }) => {
  if (AUTH_MODE === 'single')
    return { userId: 1 }
  const authHeader = headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer '))
    throw new AppError(401, 'Необходима авторизация')
  const token = authHeader.split(' ')[1]
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: number }
    return { userId: decoded.userId }
  }
  catch {
    throw new AppError(401, 'Недействительный токен')
  }
})

export const quizRouter = new Elysia({ prefix: '/api/quiz' })
  .use(authPlugin)
  .onError(({ error, set }) => {
    if (error instanceof AppError) {
      set.status = error.statusCode
      return { error: error.message }
    }
    console.error(error)
    set.status = 500
    return { error: 'Internal Server Error' }
  })
  .get('/levels', async ({ userId, query }) => {
    const language = normalizeLanguageCode(query.language || 'zh')
    return await quizService.getQuizLevels(userId, language)
  }, {
    query: t.Object({ language: t.Optional(t.String()) }),
  })
  .post('/generate', async ({ userId, body, query, request }) => {
    const config = extractLlmConfig(request)
    const targetLang = normalizeLanguageCode(query.targetLang || 'ru')
    const normalizedLang = normalizeLanguageCode(body.language)

    return await quizService.generateQuiz(userId, normalizedLang, targetLang, body.levelValue, config)
  }, {
    body: t.Object({
      language: t.String(),
      levelValue: t.String(),
    }),
    query: t.Object({ targetLang: t.Optional(t.String()) }),
  })
  .post('/submit', async ({ userId, body }) => {
    const normalizedLang = normalizeLanguageCode(body.language)

    return await quizService.submitQuiz(userId, normalizedLang, body.levelValue, body.score)
  }, {
    body: t.Object({
      language: t.String(),
      levelValue: t.String(),
      score: t.Number(),
    }),
  })
