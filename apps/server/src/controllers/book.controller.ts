import type { BatchAnalysisRequest } from '../types'
import path from 'node:path'
import { Elysia, t } from 'elysia'
import jwt from 'jsonwebtoken'
import { extractLlmConfig } from '~/utils/helpers'
import { AUTH_MODE, CORS_HEADERS, JWT_SECRET } from '../config'
import { ERROR_CODES } from '../constants/error-codes'
import { bookRepository } from '../repositories/book.repository'
import { bookAnalysisService } from '../services/book-analysis.service'
import { bookUploadService } from '../services/book-upload.service'
import { bookService } from '../services/book.service'
import { storageService } from '../services/storage.service'
import { UpdateBookSchema, UpdateStatsSchema } from '../types/schemas'
import { CACHE_PROFILES, cachePlugin } from '../utils/cache'
import { AppError, handleElysiaError } from '../utils/errors'

// A small auth plugin to extract user info from headers
const authPlugin = new Elysia({ name: 'books-auth' })
  .derive({ as: 'scoped' }, ({ request }) => {
    let userId: number | null = null
    if (AUTH_MODE === 'single') {
      userId = 1
    }
    else {
      const authHeader = request.headers.get('Authorization')
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1]
        try {
          const decoded = jwt.verify(token, JWT_SECRET) as { userId: number }
          userId = decoded.userId
        }
        catch { }
      }
    }
    return { userId }
  })
  .macro({
    requireAuth(value: boolean) {
      if (!value)
        return

      return {
        beforeHandle: ({ userId }: { userId?: number | null }) => {
          if (!userId)
            throw new AppError(401, ERROR_CODES.AUTH.UNAUTHORIZED, 'Unauthorized')
        },
      }
    },
  })
  .as('global')

export const bookController = new Elysia({ prefix: '/api/books' })
  .use(authPlugin)
  .use(cachePlugin)
  .onError(handleElysiaError)
  .get('/', async (ctx) => {
    const { userId, query, set } = ctx
    const targetLang = (query.targetLang as string) || 'ru'

    if (!userId)
      throw new AppError(401, ERROR_CODES.AUTH.UNAUTHORIZED, 'Unauthorized')

    set.headers['Cache-Control'] = CACHE_PROFILES.shortPrivate
    return bookService.getUserBooks(userId as number, targetLang)
  })
  .get('/public', async (ctx) => {
    const { userId, query, set } = ctx
    const page = Math.max(1, Number.parseInt((query.page as string) || '1'))
    const limit = Math.max(1, Number.parseInt((query.limit as string) || '20'))
    const tag = query.tag as string | undefined
    const search = query.search as string | undefined
    const language = query.lang as string | undefined
    const targetLang = (query.targetLang as string) || 'ru'

    set.headers['Cache-Control'] = 'no-store'
    return bookService.getPublicBooks(page, limit, tag || null, search || null, language || null, targetLang, (userId as number) || null)
  })
  .get('/:id/info', async ({ params: { id }, userId, query }) => {
    const targetLang = (query.targetLang as string) || 'ru'
    const info = await bookService.getBookInfo(Number(id), userId, targetLang)
    return info
  }, { cache: 'shortPrivate' })
  .post('/:id/start', async ({ params: { id }, userId }) => {
    return bookService.startReading(Number(id), userId!)
  }, { requireAuth: true })
  .post('/:id/analyze-vocabulary', async ({ params: { id }, userId }) => {
    return bookAnalysisService.analyzeVocabulary(Number(id), userId!)
  }, { requireAuth: true })
  .patch('/:id', async ({ params: { id }, userId, body }) => {
    const parsedBody = UpdateBookSchema.parse(body)
    return bookService.updateBook(Number(id), userId!, parsedBody)
  }, {
    requireAuth: true,
    body: t.Record(t.String(), t.Any()),
  })
  .post('/:id/analyze-book', async ({ params: { id }, userId, request }) => {
    const config = extractLlmConfig(request)
    return bookAnalysisService.analyzeBookStats(Number(id), userId!, config)
  }, { requireAuth: true })
  .patch('/:id/cover', async ({ params: { id }, userId, body }) => {
    const file = body.file as File
    return bookService.updateCover(Number(id), userId!, file)
  }, {
    requireAuth: true,
    body: t.Object({ file: t.File() }),
  })
  .patch('/:id/stats', async ({ params: { id }, userId, body }) => {
    const parsedBody = UpdateStatsSchema.parse(body)
    return bookService.updateStats(Number(id), userId!, parsedBody)
  }, {
    requireAuth: true,
    body: t.Object({
      difficulty: t.Optional(t.String()),
      description: t.Optional(t.String()),
      tags: t.Optional(t.Array(t.String())),
    }),
  })
  .post('/', async ({ userId, body }) => {
    const file = body.file as File
    return bookUploadService.uploadBook(userId!, file)
  }, {
    requireAuth: true,
    body: t.Object({ file: t.File() }),
  })
  .post('/upload', async ({ userId, body }) => {
    const file = body.file as File
    return bookUploadService.uploadBook(userId!, file)
  }, {
    requireAuth: true,
    body: t.Object({ file: t.File() }),
  })
  .post('/custom', async ({ userId, body }) => {
    return bookUploadService.createCustomBook(userId!, body as Parameters<typeof bookUploadService.createCustomBook>[1])
  }, {
    requireAuth: true,
    body: t.Object({
      title: t.String(),
      text: t.String(),
      targetLang: t.String(),
      author: t.Optional(t.Union([t.String(), t.Null()])),
      collection: t.Optional(t.Union([t.String(), t.Null()])),
      coverBase64: t.Optional(t.String()),
      type: t.Optional(t.String()),
      language: t.Optional(t.String()),
    }),
  })
  .post('/:id/manga-chapter', async ({ params: { id }, userId, body }) => {
    const chapterTitle = body.chapterTitle || ''
    let files = body.files
    if (!Array.isArray(files))
      files = [files]
    return bookUploadService.appendMangaChapter(Number(id), userId!, chapterTitle, files.filter(Boolean) as File[])
  }, {
    requireAuth: true,
    body: t.Object({
      chapterTitle: t.Optional(t.String()),
      files: t.Union([t.File(), t.Array(t.File())]),
    }),
  })
  .delete('/:id', async ({ params: { id }, userId }) => {
    return bookService.deleteBook(Number(id), userId!)
  }, { requireAuth: true })
  .get('/:id/toc', async ({ params: { id }, userId }) => {
    const toc = await bookService.getToc(Number(id), userId!)
    return toc
  }, { requireAuth: true, cache: 'shortPrivate' })
  .get('/:id/page/:pageNum', async ({ params: { id, pageNum }, userId, query, request }) => {
    const isSync = query.sync === 'true'
    const config = extractLlmConfig(request)
    const page = await bookService.getPage(Number(id), Number(pageNum), userId!, isSync, config)
    return page
  }, { requireAuth: true, cache: 'dayPublic' })
  .get('/:id/page/:pageNum/dict', async ({ params: { id, pageNum }, userId, query }) => {
    const targetLang = (query.targetLang as string) || 'ru'
    const dict = await bookService.getPageDictionary(Number(id), Number(pageNum), userId!, targetLang)
    return { pageDictionary: dict }
  }, { requireAuth: true, cache: 'dayPrivate' })
  .get('/:id/page/:pageNum/image', async ({ params: { id, pageNum }, set }) => {
    const pageRow = await bookRepository.getMangaPageImageUrl(Number(id), Number(pageNum))
    if (!pageRow || !pageRow.imageUrl) {
      set.status = 404
      return 'Not found'
    }

    const fileData = await storageService.getFile(pageRow.imageUrl)
    if (!fileData) {
      set.status = 404
      return 'Not found'
    }
    const buffer = Buffer.from(fileData.buffer)
    const ext = path.extname(pageRow.imageUrl).slice(1).toLowerCase()

    set.headers = {
      ...CORS_HEADERS,
      'Content-Type': `image/${ext === 'jpg' ? 'jpeg' : ext}`,
    }
    return buffer
  }, { cache: 'immutable' })
  .get('/:id/word/:word', async ({ params: { id, word }, userId, query }) => {
    const targetLang = (query.targetLang as string) || 'ru'
    return bookService.lookupWord(Number(id), word, userId!, targetLang)
  }, { requireAuth: true })
  .post('/:id/cache-check', async ({ params: { id }, userId, body, query }) => {
    const targetLang = (query.targetLang as string) || 'ru'
    const { items, language } = body as { items: unknown[], language: string }
    const results = await bookAnalysisService.checkCache(Number(id), userId!, items as { text: string, type: 'sentence' | 'word' }[], language, targetLang)
    return { results }
  }, {
    requireAuth: true,
    body: t.Object({
      items: t.Array(t.Object({
        text: t.String(),
        type: t.Union([t.Literal('sentence'), t.Literal('word')]),
      })),
      language: t.String(),
      targetLanguage: t.Optional(t.String()),
    }),
  })
  .post('/:id/analyze', async ({ params: { id }, userId, body, query, request }) => {
    const targetLang = (query.targetLang as string) || body.targetLanguage || 'ru'
    const { sentence, language, context, type } = body as { sentence: string, language: string, context?: string, type: 'sentence' | 'word' }
    const config = extractLlmConfig(request)
    return bookAnalysisService.analyzeSentence(Number(id), userId!, sentence, language, context || '', targetLang, type, config)
  }, {
    requireAuth: true,
    body: t.Object({
      sentence: t.String(),
      language: t.String(),
      context: t.Optional(t.String()),
      type: t.Union([t.Literal('sentence'), t.Literal('word')]),
      targetLanguage: t.Optional(t.String()),
    }),
  })
  .post('/:id/tts', async ({ params: { id }, userId, body, request }) => {
    const { text, voice, forceCacheBypass } = body as { text: string, voice: string, forceCacheBypass?: boolean }
    const config = extractLlmConfig(request)
    const audioBase64 = await bookService.generateTts(Number(id), userId!, text as string, voice, forceCacheBypass || false, config)
    return { audioBase64 }
  }, {
    requireAuth: true,
    body: t.Object({
      text: t.String(),
      voice: t.String(),
      forceCacheBypass: t.Optional(t.Boolean()),
    }),
  })
  .post('/:id/analyze-batch', async ({ params: { id }, userId, body, query, request }) => {
    const targetLang = (query.targetLang as string) || body.targetLanguage || 'ru'
    const { items, language } = body as { items: unknown[], language: string }
    const config = extractLlmConfig(request)
    const results = await bookAnalysisService.analyzeBatch(Number(id), userId!, items as BatchAnalysisRequest[], language, targetLang, config)
    return { results }
  }, {
    requireAuth: true,
    body: t.Object({
      items: t.Array(t.Any()),
      language: t.String(),
      targetLanguage: t.Optional(t.String()),
    }),
  })

export const ttsController = new Elysia()
  .use(authPlugin)
  .post('/api/tts', async ({ userId, body, request }) => {
    const { text, voice, forceCacheBypass } = body as { text: string, voice: string, forceCacheBypass?: boolean }
    const config = extractLlmConfig(request)
    const audioBase64 = await bookService.standaloneTts(userId!, text as string, voice, forceCacheBypass || false, config)
    return { audioBase64 }
  }, {
    requireAuth: true,
    body: t.Object({
      text: t.String(),
      voice: t.String(),
      forceCacheBypass: t.Optional(t.Boolean()),
    }),
  })

export const uploadsController = new Elysia()
  .use(cachePlugin)
  .get('/api/uploads/covers/:filename', async ({ params: { filename }, set }) => {
    const key = `covers/${filename}`
    const fileData = await storageService.getFile(key)
    if (!fileData) {
      set.status = 404
      return 'Not found'
    }
    set.headers = {
      ...CORS_HEADERS,
      'Content-Type': fileData.contentType,
    }
    return Buffer.from(fileData.buffer)
  }, { cache: 'immutable' })
