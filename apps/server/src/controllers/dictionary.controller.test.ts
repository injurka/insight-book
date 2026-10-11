import { describe, expect, it, spyOn } from 'bun:test'
import { Elysia } from 'elysia'
import jwt from 'jsonwebtoken'
import { AUTH_MODE, JWT_SECRET } from '../config'
import { dictionaryService } from '../services/dictionary.service'
import { handleElysiaError } from '../utils/errors'
import { catalogRouter } from './catalog.controller'
import { dictionaryController } from './dictionary.controller'

describe('Dictionary router authentication scope', () => {
  it('does not require dictionary authorization on subsequently composed routers', async () => {
    const app = new Elysia()
      .onError(handleElysiaError)
      .use(dictionaryController)
      .use(catalogRouter)

    const response = await app.handle(
      new Request('http://localhost/api/catalog/plugins/files/invalid-path'),
    )

    expect(response.status).toBe(400)
  })
})

describe('SRS count endpoint', () => {
  it('returns a private exact count with the same deck and language filters', async () => {
    const count = spyOn(dictionaryService, 'getReviewCount').mockResolvedValue({ count: 114 })
    try {
      const app = new Elysia().use(dictionaryController)
      const response = await app.handle(new Request('http://localhost/api/dictionary/review/count?language=zh&targetLang=ru&deckId=991,none&difficulty=HSK%201', {
        headers: { Authorization: `Bearer ${jwt.sign({ userId: 991 }, JWT_SECRET)}` },
      }))
      expect(response.status).toBe(200)
      expect(await response.json()).toEqual({ count: 114 })
      expect(response.headers.get('Cache-Control')).toContain('no-store')
      expect(count).toHaveBeenCalledWith(AUTH_MODE === 'single' ? 1 : 991, 'zh', 'ru', [991, 'none'], 'HSK 1')
    }
    finally {
      count.mockRestore()
    }
  })
})
