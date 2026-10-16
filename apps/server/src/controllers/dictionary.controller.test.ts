import { describe, expect, it, spyOn } from 'bun:test'
import { Elysia } from 'elysia'
import jwt from 'jsonwebtoken'
import { AUTH_MODE, JWT_SECRET } from '../config'
import { dictionaryService } from '../services/dictionary.service'
import { getWordPushUrl } from '../services/push.service'
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

describe('Dictionary source language routes', () => {
  it('passes source language for lookup and supports legacy deletion requests', async () => {
    const get = spyOn(dictionaryService, 'getWordFromUserDictionary').mockResolvedValue({ word: 'gift' } as Awaited<ReturnType<typeof dictionaryService.getWordFromUserDictionary>>)
    const remove = spyOn(dictionaryService, 'removeFromUserDictionary').mockResolvedValue()
    const headers = { Authorization: `Bearer ${jwt.sign({ userId: 991 }, JWT_SECRET)}` }
    try {
      const app = new Elysia().use(dictionaryController)
      expect((await app.handle(new Request('http://localhost/api/dictionary/gift?language=de&targetLang=ru', { headers }))).status).toBe(200)
      expect(get).toHaveBeenCalledWith('gift', AUTH_MODE === 'single' ? 1 : 991, 'ru', 'de')
      expect((await app.handle(new Request('http://localhost/api/dictionary/gift', { method: 'DELETE', headers }))).status).toBe(200)
      expect(remove).toHaveBeenCalledWith('gift', AUTH_MODE === 'single' ? 1 : 991, 'ru', undefined)
      expect((await app.handle(new Request('http://localhost/api/dictionary/gift?language=de&targetLang=ru', { method: 'DELETE', headers }))).status).toBe(200)
      expect(remove).toHaveBeenCalledWith('gift', AUTH_MODE === 'single' ? 1 : 991, 'ru', 'de')
      for (const language of ['en', 'de']) {
        const url = new URL(getWordPushUrl({ word: 'gift & 礼物', language }), 'http://localhost')
        const response = await app.handle(new Request(`http://localhost/api/dictionary/${encodeURIComponent(url.searchParams.get('word')!)}${url.search}`, { headers }))
        expect(response.status).toBe(200)
        expect(get).toHaveBeenLastCalledWith('gift & 礼物', AUTH_MODE === 'single' ? 1 : 991, 'ru', language)
      }
    }
    finally {
      get.mockRestore()
      remove.mockRestore()
    }
  })
})
