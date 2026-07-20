import type { BatchAnalysisRequest } from '../types'
import path from 'node:path'
import { Elysia } from 'elysia'
import jwt from 'jsonwebtoken'
import { extractLlmConfig } from '~/utils/helpers'
import { AUTH_MODE, CORS_HEADERS, JWT_SECRET } from '../config'
import { bookRepository } from '../repositories/book.repository'
import { bookAnalysisService } from '../services/book-analysis.service'
import { bookUploadService } from '../services/book-upload.service'
import { bookService } from '../services/book.service'
import { storageService } from '../services/storage.service'
import { AppError } from '../utils/errors'

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
  .macro(({ onBeforeHandle }) => ({
    requireAuth(value: boolean) {
      if (!value)
        return
      onBeforeHandle(({ userId }: { userId?: number | null }) => {
        if (!userId)
          throw new AppError(401, 'Необходима авторизация')
      })
    },
  }))
  .as('global')

export const bookController = new Elysia({ prefix: '/api/books' })
  .use(authPlugin)
  .onError(({ error, set }) => {
    if (error instanceof AppError) {
      set.status = error.statusCode
      return { error: error.message }
    }
    set.status = 500
    return { error: 'Internal Server Error' }
  })
  .get('/', async (ctx) => {
    const { userId, query } = ctx
    const tab = query.tab || 'my'
    const targetLang = (query.targetLang as string) || 'ru'

    if (tab === 'public') {
      const page = Math.max(1, Number.parseInt((query.page as string) || '1'))
      const limit = Math.max(1, Number.parseInt((query.limit as string) || '20'))
      const tag = query.tag as string | undefined
      const search = query.search as string | undefined
      const language = query.lang as string | undefined

      return bookService.getPublicBooks(page, limit, tag || null, search || null, language || null, targetLang, (userId as number) || null)
    }

    if (!userId)
      throw new AppError(401, 'Необходима авторизация')
    return bookService.getUserBooks(userId as number, targetLang)
  })
  .get('/:id/info', async ({ params: { id }, userId, query, set }) => {
    const targetLang = (query.targetLang as string) || 'ru'
    const info = await bookService.getBookInfo(Number(id), userId, targetLang)
    set.headers['Cache-Control'] = 'private, stale-while-revalidate=60'
    return info
  })
  .post('/:id/start', async ({ params: { id }, userId }) => {
    return bookService.startReading(Number(id), userId!)
  }, { requireAuth: true })
  .post('/:id/analyze-vocabulary', async ({ params: { id }, userId }) => {
    return bookAnalysisService.analyzeVocabulary(Number(id), userId!)
  }, { requireAuth: true })
  .patch('/:id', async ({ params: { id }, userId, body }) => {
    return bookService.updateBook(Number(id), userId!, body as Record<string, unknown>)
  }, { requireAuth: true })
  .post('/:id/analyze-book', async ({ params: { id }, userId, request }) => {
    const config = extractLlmConfig(request)
    return bookAnalysisService.analyzeBookStats(Number(id), userId!, config)
  }, { requireAuth: true })
  .patch('/:id/cover', async ({ params: { id }, userId, body }) => {
    const file = (body as { file: File }).file as File
    return bookService.updateCover(Number(id), userId!, file)
  }, { requireAuth: true })
  .patch('/:id/stats', async ({ params: { id }, userId, body }) => {
    return bookService.updateStats(Number(id), userId!, body as { difficulty?: string | undefined, description?: string | undefined, tags?: string[] | undefined })
  }, { requireAuth: true })
  .post('/', async ({ userId, body }) => {
    const file = (body as { file: File }).file as File
    return bookUploadService.uploadBook(userId!, file)
  }, { requireAuth: true })
  .post('/upload', async ({ userId, body }) => {
    const file = (body as { file: File }).file as File
    return bookUploadService.uploadBook(userId!, file)
  }, { requireAuth: true })
  .post('/custom', async ({ userId, body }) => {
    return bookUploadService.createCustomBook(userId!, body as { title: string, text: string, targetLang: string, author?: string | null, collection?: string | null, coverBase64?: string, type?: string, language?: string })
  }, { requireAuth: true })
  .post('/:id/manga-chapter', async ({ params: { id }, userId, body }) => {
    const chapterTitle = (body as { chapterTitle?: string }).chapterTitle || ''
    // File array handling for Elysia body
    let files = (body as { files: File | File[] }).files
    if (!Array.isArray(files))
      files = [files]
    return bookUploadService.appendMangaChapter(Number(id), userId!, chapterTitle, files.filter(Boolean))
  }, { requireAuth: true })
  .delete('/:id', async ({ params: { id }, userId }) => {
    return bookService.deleteBook(Number(id), userId!)
  }, { requireAuth: true })
  .get('/:id/toc', async ({ params: { id }, userId, set }) => {
    const toc = await bookService.getToc(Number(id), userId!)
    set.headers['Cache-Control'] = 'private, stale-while-revalidate=60'
    return toc
  }, { requireAuth: true })
  .get('/:id/page/:pageNum', async ({ params: { id, pageNum }, userId, query, request, set }) => {
    const isSync = query.sync === 'true'
    const config = extractLlmConfig(request)
    const page = await bookService.getPage(Number(id), Number(pageNum), userId!, isSync, config)
    set.headers['Cache-Control'] = 'public, max-age=86400'
    return page
  }, { requireAuth: true })
  .get('/:id/page/:pageNum/dict', async ({ params: { id, pageNum }, userId, query, set }) => {
    const targetLang = (query.targetLang as string) || 'ru'
    const dict = await bookService.getPageDictionary(Number(id), Number(pageNum), userId!, targetLang)
    set.headers['Cache-Control'] = 'private, max-age=86400'
    return { pageDictionary: dict }
  }, { requireAuth: true })
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
      'Cache-Control': 'public, max-age=31536000, immutable',
    }
    return buffer
  })
  .get('/:id/word/:word', async ({ params: { id, word }, userId, query }) => {
    const targetLang = (query.targetLang as string) || 'ru'
    return bookService.lookupWord(Number(id), word, userId!, targetLang)
  }, { requireAuth: true })
  .post('/:id/cache-check', async ({ params: { id }, userId, body, query }) => {
    const targetLang = (query.targetLang as string) || 'ru'
    const { items, language } = body as { items: unknown[], language: string }
    const results = await bookAnalysisService.checkCache(Number(id), userId!, items as { text: string, type: 'sentence' | 'word' }[], language, targetLang)
    return { results }
  }, { requireAuth: true })
  .post('/:id/analyze', async ({ params: { id }, userId, body, query, request }) => {
    const targetLang = (query.targetLang as string) || (body as { targetLanguage?: string }).targetLanguage || 'ru'
    const { sentence, language, context, type } = body as { sentence: string, language: string, context: string, type: 'sentence' | 'word' }
    const config = extractLlmConfig(request)
    return bookAnalysisService.analyzeSentence(Number(id), userId!, sentence, language, context, targetLang, type, config)
  }, { requireAuth: true })
  .post('/:id/tts', async ({ params: { id }, userId, body, request }) => {
    const { text, voice, forceCacheBypass } = body as { text: string, voice: string, forceCacheBypass?: boolean }
    const config = extractLlmConfig(request)
    const audioBase64 = await bookService.generateTts(Number(id), userId!, text as string, voice, forceCacheBypass || false, config)
    return { audioBase64 }
  }, { requireAuth: true })
  .post('/:id/analyze-batch', async ({ params: { id }, userId, body, query, request }) => {
    const targetLang = (query.targetLang as string) || (body as { targetLanguage?: string }).targetLanguage || 'ru'
    const { items, language } = body as { items: unknown[], language: string }
    const config = extractLlmConfig(request)
    const results = await bookAnalysisService.analyzeBatch(Number(id), userId!, items as BatchAnalysisRequest[], language, targetLang, config)
    return { results }
  }, { requireAuth: true })

export const ttsController = new Elysia()
  .use(authPlugin)
  .post('/api/tts', async ({ userId, body, request }) => {
    const { text, voice, forceCacheBypass } = body as { text: string, voice: string, forceCacheBypass?: boolean }
    const config = extractLlmConfig(request)
    const audioBase64 = await bookService.standaloneTts(userId!, text as string, voice, forceCacheBypass || false, config)
    return { audioBase64 }
  }, { requireAuth: true })

export const uploadsController = new Elysia()
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
      'Cache-Control': 'public, max-age=31536000, immutable',
    }
    return Buffer.from(fileData.buffer)
  })
