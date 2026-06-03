/// <reference types="bun-types" />

import type { PagePayload } from '../types'
import { readFileSync } from 'node:fs'
import { rm, unlink } from 'node:fs/promises'
import path from 'node:path'
import { and, desc, eq, or } from 'drizzle-orm'
import { parse as parseHtml } from 'node-html-parser'
import { z } from 'zod'
import { BOOKS_PATH, CORS_HEADERS, COVERS_PATH } from '../config'
import { db } from '../db'
import * as schema from '../db/schema'
import { lookupSingleWord, lookupWords } from '../services/dictionary.service'
import { analyzeBookExcerpt, analyzeSentence, extractLlmConfig, generateTts } from '../services/llm.service'
import { recognizeMangaPage } from '../services/ocr.service'
import { AppError } from '../utils/errors'
import { createRateLimiter } from '../utils/rate-limit'
import { runWorkerTask } from '../workers/worker-client'

const llmLimiter = createRateLimiter(600, 60 * 1000)

function json(data: unknown, status = 200, extraHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json', ...extraHeaders },
  })
}

function extractUniqueWordsFromHtml(html: string): string[] {
  const words = new Set<string>()
  const regex = /data-word="([^"]+)"/g
  let match

  // eslint-disable-next-line no-cond-assign
  while ((match = regex.exec(html)) !== null) {
    try {
      const word = decodeURIComponent(match[1])
      if (/[\p{L}\p{N}]/u.test(word)) {
        words.add(word)
        words.add(word.toLowerCase())
      }
    }
    catch { }
  }
  return Array.from(words)
}

const UpdateBookSchema = z.object({
  title: z.string().optional(),
  author: z.string().nullable().optional(),
  coverUrl: z.string().nullable().optional(),
  language: z.string().optional(),
  createdAt: z.string().optional(),
  currentPage: z.number().optional(),
  series: z.string().nullable().optional(),
  seriesNumber: z.number().nullable().optional(),
  status: z.enum(['reading', 'to-read', 'have-read']).optional(),
  isFavorite: z.boolean().optional(),
  collection: z.string().nullable().optional(),
  isPublic: z.boolean().optional(),
})

const UpdateStatsSchema = z.object({
  description: z.string().optional(),
  difficulty: z.string().optional(),
  tags: z.array(z.string()).optional(),
})

const AnalyzeSentenceSchema = z.object({
  sentence: z.string().min(1, 'Предложение не может быть пустым'),
  language: z.string().min(1, 'Язык обязателен'),
})

const GenerateTtsSchema = z.object({
  text: z.string().min(1, 'Текст не передан'),
})

const GenerateTtsStandaloneSchema = z.object({
  text: z.string().min(1, 'Текст не передан'),
  language: z.string().min(1, 'Язык обязателен'),
})

export async function handleGetBooks(req: Request, userId: number): Promise<Response> {
  const allBooks = await db.query.books.findMany({
    where: or(
      eq(schema.books.userId, userId),
      eq(schema.books.isPublic, true),
    ),
    with: { progresses: { where: eq(schema.readingProgress.userId, userId), limit: 1 } },
    orderBy: [desc(schema.books.updatedAt)],
  })

  // Фильтруем те публичные книги, которые юзер еще не начал читать (чтобы они не захламляли библиотеку)
  const result = allBooks
    .filter(b => b.userId === userId || b.progresses.length > 0)
    .map((book) => {
      const progress = book.progresses[0]
      const { progresses, ...bookData } = book
      return {
        ...bookData,
        currentPage: progress?.currentPage ?? null,
        progressUpdatedAt: progress?.updatedAt ?? null,
      }
    })

  result.sort((a, b) => {
    const tA = new Date(a.progressUpdatedAt || a.updatedAt).getTime()
    const tB = new Date(b.progressUpdatedAt || b.updatedAt).getTime()
    return tB - tA
  })

  return json(result)
}

export async function handleGetBookInfo(req: Request, userId: number): Promise<Response> {
  const id = Number((req as any).params.id)
  const book = await db.query.books.findFirst({
    where: and(
      eq(schema.books.id, id),
      or(eq(schema.books.userId, userId), eq(schema.books.isPublic, true)),
    ),
    with: { progresses: { where: eq(schema.readingProgress.userId, userId), limit: 1 }, stats: true },
  })
  if (!book)
    throw new AppError(404, 'Книга не найдена или доступ закрыт')

  const progress = book.progresses[0]
  const { progresses, stats, ...bookData } = book
  const statsResult = stats
    ? {
      ...stats,
      tags: stats.tags ? JSON.parse(stats.tags) : [],
      posDistribution: stats.posDistribution ? JSON.parse(stats.posDistribution) : null,
      topWords: stats.topWords ? JSON.parse(stats.topWords) : null,
    }
    : null

  return json({ ...bookData, currentPage: progress?.currentPage ?? null, toc: book.toc ? JSON.parse(book.toc) : [], stats: statsResult }, 200, {
    'Cache-Control': 'private, stale-while-revalidate=60',
  })
}

export async function handleAnalyzeVocabulary(req: Request, userId: number): Promise<Response> {
  const id = Number((req as any).params.id)
  const book = await db.query.books.findFirst({ where: eq(schema.books.id, id) })
  if (!book || book.userId !== userId)
    throw new AppError(403, 'Нет доступа')

  const result = await runWorkerTask('analyzeBookVocabulary', { bookId: id, language: book.language })

  await db.insert(schema.bookStats).values({
    bookId: id,
    posDistribution: JSON.stringify(result.posDistribution),
    topWords: JSON.stringify(result.topWords),
    lexicalDiversity: result.lexicalDiversity,
  }).onConflictDoUpdate({
    target: schema.bookStats.bookId,
    set: { posDistribution: JSON.stringify(result.posDistribution), topWords: JSON.stringify(result.topWords), lexicalDiversity: result.lexicalDiversity },
  })

  return json({ success: true, lexicalStats: result })
}

export async function handleUpdateBook(req: Request, userId: number): Promise<Response> {
  const id = Number((req as any).params.id)
  const body = UpdateBookSchema.parse(await req.json())

  const book = await db.query.books.findFirst({ where: eq(schema.books.id, id) })
  if (!book)
    throw new AppError(404, 'Книга не найдена')

  // Если это не владелец, он может только сохранить свой прогресс
  if (book.userId !== userId) {
    if (!book.isPublic)
      throw new AppError(404, 'Книга не найдена или доступ закрыт')

    if (typeof body.currentPage === 'number') {
      await db.insert(schema.readingProgress).values({
        bookId: id,
        userId,
        currentPage: body.currentPage,
        updatedAt: new Date().toISOString(),
      }).onConflictDoUpdate({
        target: [schema.readingProgress.bookId, schema.readingProgress.userId],
        set: { currentPage: body.currentPage, updatedAt: new Date().toISOString() },
      })
    }
    return json({ success: true })
  }

  // Обновление от лица владельца
  await db.update(schema.books).set({
    title: body.title,
    author: body.author,
    coverUrl: body.coverUrl,
    language: body.language,
    series: body.series,
    seriesNumber: body.seriesNumber,
    createdAt: body.createdAt,
    status: body.status,
    isFavorite: body.isFavorite,
    collection: body.collection,
    isPublic: body.isPublic,
    updatedAt: new Date().toISOString(),
  }).where(eq(schema.books.id, id))

  if (typeof body.currentPage === 'number') {
    await db.insert(schema.readingProgress).values({
      bookId: id,
      userId,
      currentPage: body.currentPage,
      updatedAt: new Date().toISOString(),
    }).onConflictDoUpdate({
      target: [schema.readingProgress.bookId, schema.readingProgress.userId],
      set: { currentPage: body.currentPage, updatedAt: new Date().toISOString() },
    })
  }
  return json({ success: true })
}

export async function handleAnalyzeBookStats(req: Request, userId: number): Promise<Response> {
  llmLimiter(String(userId))
  const config = extractLlmConfig(req)

  const id = Number((req as any).params.id)
  const book = await db.query.books.findFirst({ where: eq(schema.books.id, id) })
  if (!book || book.userId !== userId)
    throw new AppError(403, 'Нет доступа')

  const pages = await db.select({ content: schema.bookPages.content }).from(schema.bookPages).where(eq(schema.bookPages.bookId, id)).orderBy(schema.bookPages.pageNum)
  if (!pages.length)
    throw new AppError(400, 'Страницы для анализа не найдены')

  let excerpt = ''
  for (const p of pages) {
    if (excerpt.length >= 3000)
      break
    const plainText = parseHtml(p.content).textContent
    excerpt += `${plainText}\n`
  }
  excerpt = excerpt.substring(0, 3000)

  const aiData = await analyzeBookExcerpt(excerpt, config)
  const tagsJson = JSON.stringify(aiData.tags || [])

  let totalItems = 0
  const uniqueSet = new Set<string>()

  for (const p of pages) {
    const plainText = parseHtml(p.content).textContent
    if (book.language === 'zh' || book.language === 'ja') {
      const chars = plainText.match(/[\p{L}\p{N}]/gu) || []
      totalItems += chars.length
      for (const c of chars) uniqueSet.add(c)
    }
    else {
      const words = plainText.match(/[\p{L}\p{N}]+/gu) || []
      totalItems += words.length
      for (const w of words) uniqueSet.add(w.toLowerCase())
    }
  }

  await db.insert(schema.bookStats).values({ bookId: id, description: aiData.description, difficulty: aiData.difficulty, tags: tagsJson, totalChars: totalItems, uniqueChars: uniqueSet.size }).onConflictDoUpdate({ target: schema.bookStats.bookId, set: { description: aiData.description, difficulty: aiData.difficulty, tags: tagsJson, totalChars: totalItems, uniqueChars: uniqueSet.size } })
  const newStats = await db.query.bookStats.findFirst({ where: eq(schema.bookStats.bookId, id) })
  return json({ success: true, stats: newStats ? { ...newStats, tags: newStats.tags ? JSON.parse(newStats.tags) : [], posDistribution: newStats.posDistribution ? JSON.parse(newStats.posDistribution) : null, topWords: newStats.topWords ? JSON.parse(newStats.topWords) : null } : null })
}

export async function handleUpdateCover(req: Request, userId: number): Promise<Response> {
  const id = Number((req as any).params.id)

  const oldBook = await db.query.books.findFirst({ where: eq(schema.books.id, id), columns: { coverUrl: true, userId: true } })
  if (!oldBook || oldBook.userId !== userId)
    throw new AppError(403, 'Нет доступа')

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file)
    throw new AppError(400, 'Файл не передан')

  const buffer = await file.arrayBuffer()
  const ext = path.extname(file.name).toLowerCase() || '.jpg'
  const filename = `${Date.now()}_cover${ext}`
  const filepath = path.join(COVERS_PATH, filename)

  await Bun.write(filepath, buffer)
  const coverUrl = `/api/uploads/covers/${filename}`

  await db.transaction(async (tx) => {
    await tx.update(schema.books).set({ coverUrl }).where(eq(schema.books.id, id))
  })

  if (oldBook.coverUrl && oldBook.coverUrl.startsWith('/api/uploads/covers/')) {
    const oldFile = oldBook.coverUrl.split('/').pop()!
    const resolvedOld = path.resolve(path.join(COVERS_PATH, oldFile))
    if (resolvedOld.startsWith(path.resolve(COVERS_PATH))) {
      await unlink(resolvedOld).catch(() => { })
    }
  }

  return json({ success: true, coverUrl })
}

export async function handleGetCoverImage(req: Request): Promise<Response> {
  const filename = (req as any).params.filename
  const filepath = path.join(COVERS_PATH, filename)
  const file = Bun.file(filepath)

  if (!(await file.exists()))
    return new Response('Not found', { status: 404 })

  return new Response(file, {
    headers: {
      ...CORS_HEADERS,
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  })
}

export async function handleUpdateStats(req: Request, userId: number): Promise<Response> {
  const id = Number((req as any).params.id)
  const book = await db.query.books.findFirst({ where: eq(schema.books.id, id) })
  if (!book || book.userId !== userId)
    throw new AppError(403, 'Нет доступа')

  const body = UpdateStatsSchema.parse(await req.json())
  const tagsJson = JSON.stringify(body.tags || [])

  await db.insert(schema.bookStats).values({ bookId: id, description: body.description || '', difficulty: body.difficulty || '', tags: tagsJson }).onConflictDoUpdate({ target: schema.bookStats.bookId, set: { description: body.description || '', difficulty: body.difficulty || '', tags: tagsJson } })
  const stats = await db.query.bookStats.findFirst({ where: eq(schema.bookStats.bookId, id) })
  return json({ success: true, stats: stats ? { ...stats, tags: stats.tags ? JSON.parse(stats.tags) : [], posDistribution: stats.posDistribution ? JSON.parse(stats.posDistribution) : null, topWords: stats.topWords ? JSON.parse(stats.topWords) : null } : null })
}

export async function handleUploadBook(req: Request, userId: number): Promise<Response> {
  const formData = await req.formData()
  const file = formData.get('file') as File | null

  if (!file) {
    throw new AppError(400, 'Файл не передан')
  }

  const MAX_FILE_SIZE = 200 * 1024 * 1024
  if (file.size > MAX_FILE_SIZE) {
    throw new AppError(413, `Размер файла превышает лимит в 200 МБ. Ваш файл: ${(file.size / 1024 / 1024).toFixed(2)} МБ`)
  }

  const filename = file.name.toLowerCase()
  let bookId: number

  const arrayBuffer = await file.arrayBuffer()

  if (filename.endsWith('.epub')) {
    bookId = await runWorkerTask('processEpub', { buffer: arrayBuffer, filename: file.name, userId })
  }
  else if (filename.endsWith('.fb2') || filename.endsWith('.fb2.zip')) {
    bookId = await runWorkerTask('processFb2', { buffer: arrayBuffer, filename: file.name, userId })
  }
  else if (filename.endsWith('.cbz') || filename.endsWith('.zip')) {
    bookId = await runWorkerTask('processCbz', { buffer: arrayBuffer, filename: file.name, userId })
  }
  else {
    throw new AppError(400, 'Поддерживаются только .epub, .cbz, .zip и .fb2 файлы')
  }

  const book = await db.query.books.findFirst({ where: eq(schema.books.id, bookId) })
  return json({ success: true, book })
}

export async function handleDeleteBook(req: Request, userId: number): Promise<Response> {
  const id = Number((req as any).params.id)
  const book = await db.query.books.findFirst({ where: eq(schema.books.id, id), columns: { filePath: true, coverUrl: true, userId: true } })
  if (!book)
    throw new AppError(404, 'Книга не найдена')

  // Если это не владелец, то мы просто скрываем её (удаляем его личный прогресс)
  if (book.userId !== userId) {
    await db.delete(schema.readingProgress).where(and(eq(schema.readingProgress.bookId, id), eq(schema.readingProgress.userId, userId)))
    return json({ success: true })
  }

  await db.transaction(async (tx) => {
    await tx.delete(schema.books).where(eq(schema.books.id, id))
  })

  try {
    if (book.filePath) {
      const resolvedPath = path.resolve(book.filePath)

      if (!resolvedPath.startsWith(path.resolve(BOOKS_PATH))) {
        throw new Error('Security violation: Invalid book path')
      }

      await rm(resolvedPath, { recursive: true, force: true })
    }
    if (book.coverUrl && book.coverUrl.startsWith('/api/uploads/covers/')) {
      const coverFilename = book.coverUrl.split('/').pop()!
      const resolvedCoverPath = path.resolve(path.join(COVERS_PATH, coverFilename))

      if (!resolvedCoverPath.startsWith(path.resolve(COVERS_PATH))) {
        throw new Error('Security violation: Invalid cover path')
      }

      await unlink(resolvedCoverPath).catch(() => { })
    }
  }
  catch (err: any) {
    console.warn(`[File Delete Warning] Не удалось удалить файлы книги:`, err.message)
  }

  return json({ success: true })
}

export async function handleGetToc(req: Request, userId: number): Promise<Response> {
  const bookId = Number((req as any).params.id)
  const book = await db.query.books.findFirst({ where: eq(schema.books.id, bookId), columns: { toc: true, userId: true, isPublic: true } })

  if (!book || (book.userId !== userId && !book.isPublic))
    throw new AppError(403, 'Нет доступа к книге')

  return json(book.toc ? JSON.parse(book.toc) : [], 200, {
    'Cache-Control': 'private, stale-while-revalidate=60',
  })
}

export async function handleGetPage(req: Request, userId: number): Promise<Response> {
  const { id: bookId, pageNum } = (req as any).params
  const config = extractLlmConfig(req)
  const url = new URL(req.url)
  const isSync = url.searchParams.get('sync') === 'true'

  const book = db.select({ totalPages: schema.books.totalPages, language: schema.books.language, type: schema.books.type, userId: schema.books.userId, isPublic: schema.books.isPublic })
    .from(schema.books)
    .where(eq(schema.books.id, bookId))
    .get()

  if (!book)
    throw new AppError(404, 'Книга не найдена')
  if (book.userId !== userId && !book.isPublic)
    throw new AppError(403, 'Нет доступа к книге')

  if (!isSync) {
    await db.insert(schema.readingProgress)
      .values({ bookId, userId, currentPage: pageNum, updatedAt: new Date().toISOString() })
      .onConflictDoUpdate({ target: [schema.readingProgress.bookId, schema.readingProgress.userId], set: { currentPage: pageNum, updatedAt: new Date().toISOString() } })
  }

  if (book.type === 'manga') {
    const pageRow = db.select().from(schema.mangaPages).where(and(eq(schema.mangaPages.bookId, bookId), eq(schema.mangaPages.pageNum, pageNum))).get()
    if (!pageRow)
      throw new AppError(404, 'Страница манги не найдена')

    let ocrBlocks = pageRow.ocrData ? JSON.parse(pageRow.ocrData) : null
    let pageDictionary = {}

    if (ocrBlocks === null && pageRow.imageUrl) {
      try {
        const imageBuffer = readFileSync(pageRow.imageUrl)
        const base64 = imageBuffer.toString('base64')
        ocrBlocks = await recognizeMangaPage(base64, config)
        await db.update(schema.mangaPages).set({ ocrData: JSON.stringify(ocrBlocks) }).where(eq(schema.mangaPages.id, pageRow.id))
      }
      catch (e: any) {
        console.error('OCR Error:', e.message)
        ocrBlocks = []
      }
    }

    if (ocrBlocks && ocrBlocks.length > 0) {
      const { processedBlocks, uniqueWords } = await runWorkerTask('tokenizeOcrBlocks', { blocks: ocrBlocks, language: book.language })
      ocrBlocks = processedBlocks
      pageDictionary = await lookupWords(uniqueWords, book.language, userId)
    }

    return json({
      bookId,
      pageNum,
      totalPages: book.totalPages,
      type: 'manga',
      imageUrl: `/api/books/${bookId}/page/${pageNum}/image`,
      imageWidth: pageRow.imageWidth,
      imageHeight: pageRow.imageHeight,
      ocrBlocks: ocrBlocks || [],
      content: '',
      pageDictionary,
    }, 200, { 'Cache-Control': 'public, max-age=86400' })
  }

  const cached = await db.query.nlpCache.findFirst({
    where: and(eq(schema.nlpCache.bookId, bookId), eq(schema.nlpCache.pageNum, pageNum)),
  })

  if (cached) {
    try {
      const parsed = JSON.parse(cached.data) as PagePayload
      const uniqueWords = extractUniqueWordsFromHtml(parsed.content)
      parsed.pageDictionary = await lookupWords(uniqueWords, book.language, userId)
      return json(parsed, 200, { 'Cache-Control': 'public, max-age=86400' })
    }
    catch { }
  }

  const pageRow = db.select({ content: schema.bookPages.content }).from(schema.bookPages).where(and(eq(schema.bookPages.bookId, bookId), eq(schema.bookPages.pageNum, pageNum))).get()
  if (!pageRow)
    throw new AppError(404, 'Страница не найдена')

  const { processedHtml, uniqueWords } = await runWorkerTask('tokenizeHtmlPage', { html: pageRow.content, language: book.language })
  const pageDictionary = await lookupWords(uniqueWords, book.language, userId)
  const payload: PagePayload = { bookId, pageNum, totalPages: book.totalPages, content: processedHtml, pageDictionary, type: 'epub' }

  await db.transaction(async (tx) => {
    await tx.delete(schema.nlpCache).where(and(eq(schema.nlpCache.bookId, bookId), eq(schema.nlpCache.pageNum, pageNum)))
    await tx.insert(schema.nlpCache).values({ bookId, pageNum, data: JSON.stringify(payload) })
  })

  return json(payload, 200, { 'Cache-Control': 'public, max-age=86400' })
}

export async function handleLookupWord(req: Request, userId: number): Promise<Response> {
  const { id: bookId, word } = (req as any).params
  const book = await db.query.books.findFirst({ where: eq(schema.books.id, bookId), columns: { language: true, userId: true, isPublic: true } })
  if (!book || (book.userId !== userId && !book.isPublic))
    throw new AppError(403, 'Нет доступа')

  const lang = book.language || 'en'
  const entry = await lookupSingleWord(decodeURIComponent(word), lang, userId)
  if (!entry)
    throw new AppError(404, 'Слово не найдено в локальном словаре')
  return json(entry)
}

export async function handleAnalyzeSentence(req: Request, userId: number): Promise<Response> {
  llmLimiter(String(userId))
  const config = extractLlmConfig(req)

  const bookId = Number((req as any).params.id)
  const book = await db.query.books.findFirst({ where: eq(schema.books.id, bookId), columns: { id: true, userId: true, isPublic: true } })
  if (!book || (book.userId !== userId && !book.isPublic))
    throw new AppError(403, 'Нет доступа')

  const { sentence, language } = AnalyzeSentenceSchema.parse(await req.json())
  const analysis = await analyzeSentence(bookId, sentence, language, config)
  return json(analysis)
}

export async function handleGenerateTts(req: Request, userId: number): Promise<Response> {
  llmLimiter(String(userId))
  const config = extractLlmConfig(req)

  const bookId = Number((req as any).params.id)
  const book = await db.query.books.findFirst({ where: eq(schema.books.id, bookId), columns: { language: true, userId: true, isPublic: true } })
  if (!book || (book.userId !== userId && !book.isPublic))
    throw new AppError(403, 'Нет доступа')

  const { text } = GenerateTtsSchema.parse(await req.json())
  const audioBase64 = await generateTts(text, book.language, config)
  return json({ audioBase64 })
}

export async function handleStandaloneTts(req: Request, userId: number): Promise<Response> {
  llmLimiter(String(userId))
  const config = extractLlmConfig(req)

  const { text, language } = GenerateTtsStandaloneSchema.parse(await req.json())
  const audioBase64 = await generateTts(text, language, config)
  return json({ audioBase64 })
}

export async function handleGetPageImage(req: Request): Promise<Response> {
  const { id: bookId, pageNum } = (req as any).params
  const pageRow = db.select({ imageUrl: schema.mangaPages.imageUrl })
    .from(schema.mangaPages)
    .where(and(eq(schema.mangaPages.bookId, bookId), eq(schema.mangaPages.pageNum, pageNum)))
    .get()

  if (!pageRow || !pageRow.imageUrl)
    return new Response('Not found', { status: 404 })

  const buffer = readFileSync(pageRow.imageUrl)
  const ext = path.extname(pageRow.imageUrl).slice(1).toLowerCase()

  return new Response(buffer, {
    headers: {
      ...CORS_HEADERS,
      'Content-Type': `image/${ext === 'jpg' ? 'jpeg' : ext}`,
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  })
}
