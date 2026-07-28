import type { APIRequestContext } from '@playwright/test'
import { ADMIN_CREDENTIALS } from '../fixtures'

export interface SeedWord {
  word: string
  translation: string
  language?: string
}

/**
 * Логин через API (Bearer token) и добавление слов в словарь admin'а
 * напрямую через POST /api/dictionary — быстрее и стабильнее, чем через UI.
 *
 * NB: baseURL у request-фикстуры — это vite dev-сервер, /api проксируется
 * на e2e backend, поэтому относительные пути работают.
 */
export async function seedDictionaryWords(request: APIRequestContext, words: SeedWord[]) {
  const loginRes = await request.post('/api/auth/login', {
    data: { login: ADMIN_CREDENTIALS.login, password: ADMIN_CREDENTIALS.password },
  })
  if (!loginRes.ok())
    throw new Error(`API login failed: ${loginRes.status()} ${await loginRes.text()}`)
  const { token } = await loginRes.json()

  const headers = { Authorization: `Bearer ${token}` }
  for (const w of words) {
    const res = await request.post('/api/dictionary', {
      headers,
      data: {
        word: w.word,
        translation: w.translation,
        language: w.language ?? 'en',
      },
    })
    if (!res.ok())
      throw new Error(`Failed to seed word "${w.word}": ${res.status()} ${await res.text()}`)
  }
}
