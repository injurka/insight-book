import type { PagePayload } from '../types'
import { readFileSync } from 'node:fs'
import { rm, unlink } from 'node:fs/promises'
import path from 'node:path'
import { and, desc, eq } from 'drizzle-orm'
import { parse as parseHtml } from 'node-html-parser'
import { z } from 'zod'
import { CORS_HEADERS, COVERS_PATH } from '../config'
import { db } from '../db'
import * as schema from '../db/schema'
import { lookupSingleWord, lookupWords } from '../services/dictionary.service'
import { analyzeBookExcerpt, analyzeSentence, generateTts } from '../services/llm.service'
import { recognizeMangaPage } from '../services/ocr.service'
import { AppError } from '../utils/errors'
import { createRateLimiter } from '../utils/rate-limit'
import { runWorkerTask } from '../workers/worker-client'

const llmLimiter = createRateLimiter(60, 60 * 1000)

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
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

// Zod-Схемы валидации
const UpdateBookSchema = z.object({
  title: z.string().optional(),
  author: z.string().nullable().optional(),
  coverUrl: z.string().nullable().optional(),
  language: z.string().optional(),
  createdAt: z.string().optional(),
  currentPage: z.number().optional(),
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

export async function handleGetBooks(req: Request, userId: number): Promise<Response> {
  const books = await db.query.books.findMany({
    where: eq(schema.books.userId, userId),
    with: { progress: { columns: { currentPage: true } } },
    orderBy: [desc(schema.books.createdAt)],
  })
  const result = books.map(({ progress, ...book }) => ({ ...book, currentPage: progress?.currentPage ?? null }))
  return json(result)
}

export async function handleGetBookInfo(req: Request, userId: number): Promise<Response> {
  const id = Number((req as any).params.id)
  const book = await db.query.books.findFirst({
    where: and(eq(schema.books.id, id), eq(schema.books.userId, userId)),
    with: { progress: { columns: { currentPage: true } }, stats: true },
  })
  if (!book)
    throw new AppError(404, 'Книга не найдена')

  const { progress, stats, ...bookData } = book
  const statsResult = stats
    ? {
        ...stats,
        tags: stats.tags ? JSON.parse(stats.tags) : [],
        posDistribution: stats.posDistribution ? JSON.parse(stats.posDistribution) : null,
        topWords: stats.topWords ? JSON.parse(stats.topWords) : null,
      }
    : null

  return json({ ...bookData, currentPage: progress?.currentPage ?? null, toc: book.toc ? JSON.parse(book.toc) : [], stats: statsResult })
}

export async function handleAnalyzeVocabulary(req: Request, userId: number): Promise<Response> {
  const id = Number((req as any).params.id)
  const book = await db.query.books.findFirst({ where: and(eq(schema.books.id, id), eq(schema.books.userId, userId)) })
  if (!book)
    throw new AppError(404, 'Книга не найдена')

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

  const book = await db.query.books.findFirst({ where: and(eq(schema.books.id, id), eq(schema.books.userId, userId)) })
  if (!book)
    throw new AppError(404, 'Книга не найдена')

  await db.update(schema.books).set({
    title: body.title,
    author: body.author,
    coverUrl: body.coverUrl,
    language: body.language,
    createdAt: body.createdAt,
    updatedAt: new Date().toISOString(),
  }).where(eq(schema.books.id, id))

  if (typeof body.currentPage === 'number') {
    await db.insert(schema.readingProgress).values({ bookId: id, currentPage: body.currentPage, updatedAt: new Date().toISOString() }).onConflictDoUpdate({ target: schema.readingProgress.bookId, set: { currentPage: body.currentPage, updatedAt: new Date().toISOString() } })
  }
  return json({ success: true })
}

export async function handleAnalyzeBookStats(req: Request, userId: number): Promise<Response> {
  llmLimiter(String(userId))

  const id = Number((req as any).params.id)
  const book = await db.query.books.findFirst({ where: and(eq(schema.books.id, id), eq(schema.books.userId, userId)) })
  if (!book)
    throw new AppError(404, 'Книга не найдена')

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

  const aiData = await analyzeBookExcerpt(excerpt)
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

  const oldBook = await db.query.books.findFirst({ where: and(eq(schema.books.id, id), eq(schema.books.userId, userId)), columns: { coverUrl: true } })
  if (!oldBook)
    throw new AppError(404, 'Книга не найдена')

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
    await unlink(path.join(COVERS_PATH, oldFile)).catch(() => { })
  }

  return json({ success: true, coverUrl })
}

export async function handleGetCoverImage(req: Request): Promise<Response> {
  const filename = (req as any).params.filename
  const filepath = path.join(COVERS_PATH, filename)
  const file = Bun.file(filepath)

  if (!(await file.exists()))
    return new Response('Not found', { status: 404 })

  return new Response(file, { headers: CORS_HEADERS })
}

export async function handleUpdateStats(req: Request, userId: number): Promise<Response> {
  const id = Number((req as any).params.id)
  const book = await db.query.books.findFirst({ where: and(eq(schema.books.id, id), eq(schema.books.userId, userId)) })
  if (!book)
    throw new AppError(404, 'Книга не найдена')

  const body = UpdateStatsSchema.parse(await req.json())
  const tagsJson = JSON.stringify(body.tags || [])

  await db.insert(schema.bookStats).values({ bookId: id, description: body.description || '', difficulty: body.difficulty || '', tags: tagsJson }).onConflictDoUpdate({ target: schema.bookStats.bookId, set: { description: body.description || '', difficulty: body.difficulty || '', tags: tagsJson } })
  const stats = await db.query.bookStats.findFirst({ where: eq(schema.bookStats.bookId, id) })
  return json({ success: true, stats: stats ? { ...stats, tags: stats.tags ? JSON.parse(stats.tags) : [], posDistribution: stats.posDistribution ? JSON.parse(stats.posDistribution) : null, topWords: stats.topWords ? JSON.parse(stats.topWords) : null } : null })
}

export async function handleUploadBook(req: Request, userId: number): Promise<Response> {
  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file)
    throw new AppError(400, 'Файл не передан')

  const filename = file.name.toLowerCase()
  let bookId: number

  const arrayBuffer = await file.arrayBuffer()

  if (filename.endsWith('.epub')) {
    bookId = await runWorkerTask('processEpub', { buffer: arrayBuffer, filename: file.name, userId })
  }
  else if (filename.endsWith('.cbz') || filename.endsWith('.zip')) {
    bookId = await runWorkerTask('processCbz', { buffer: arrayBuffer, filename: file.name, userId })
  }
  else if (filename.endsWith('.fb2')) {
    bookId = await runWorkerTask('processFb2', { buffer: arrayBuffer, filename: file.name, userId })
  }
  else {
    throw new AppError(400, 'Поддерживаются только .epub, .cbz, .zip и .fb2 файлы')
  }

  const book = await db.query.books.findFirst({ where: eq(schema.books.id, bookId) })
  return json({ success: true, book })
}

export async function handleDeleteBook(req: Request, userId: number): Promise<Response> {
  const id = Number((req as any).params.id)
  const book = await db.query.books.findFirst({ where: and(eq(schema.books.id, id), eq(schema.books.userId, userId)), columns: { filePath: true, coverUrl: true } })
  if (!book)
    throw new AppError(404, 'Книга не найдена')

  await db.transaction(async (tx) => {
    await tx.delete(schema.books).where(eq(schema.books.id, id))
  })

  try {
    if (book.filePath) {
      await rm(book.filePath, { recursive: true, force: true })
    }
    if (book.coverUrl && book.coverUrl.startsWith('/api/uploads/covers/')) {
      const coverFilename = book.coverUrl.split('/').pop()!
      await unlink(path.join(COVERS_PATH, coverFilename)).catch(() => { })
    }
  }
  catch (err: any) {
    console.warn(`[File Delete Warning] Не удалось удалить файлы книги:`, err.message)
  }

  return json({ success: true })
}

export async function handleGetToc(req: Request, userId: number): Promise<Response> {
  const bookId = Number((req as any).params.id)
  const book = await db.select({ toc: schema.books.toc }).from(schema.books).where(and(eq(schema.books.id, bookId), eq(schema.books.userId, userId))).get()
  if (!book)
    throw new AppError(404, 'Книга не найдена')
  return json(book.toc ? JSON.parse(book.toc) : [])
}

export async function handleGetPage(req: Request, userId: number): Promise<Response> {
  const { id: bookId, pageNum } = (req as any).params

  const book = await db.select({ totalPages: schema.books.totalPages, language: schema.books.language, type: schema.books.type })
    .from(schema.books)
    .where(and(eq(schema.books.id, bookId), eq(schema.books.userId, userId)))
    .get()

  if (!book)
    throw new AppError(404, 'Книга не найдена')

  await db.insert(schema.readingProgress)
    .values({ bookId, currentPage: pageNum, updatedAt: new Date().toISOString() })
    .onConflictDoUpdate({ target: schema.readingProgress.bookId, set: { currentPage: pageNum } })

  // === ЛОГИКА ДЛЯ МАНГИ ===
  if (book.type === 'manga') {
    const pageRow = await db.select().from(schema.mangaPages).where(and(eq(schema.mangaPages.bookId, bookId), eq(schema.mangaPages.pageNum, pageNum))).get()
    if (!pageRow)
      throw new AppError(404, 'Страница манги не найдена')

    let ocrBlocks = pageRow.ocrData ? JSON.parse(pageRow.ocrData) : null
    let pageDictionary = {}

    if (ocrBlocks === null && pageRow.imageUrl) {
      try {
        const imageBuffer = readFileSync(pageRow.imageUrl)
        const base64 = imageBuffer.toString('base64')
        ocrBlocks = await recognizeMangaPage(base64)
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
    })
  }

  // === ЛОГИКА ДЛЯ EPUB ===
  const cached = await db.query.nlpCache.findFirst({
    where: and(eq(schema.nlpCache.bookId, bookId), eq(schema.nlpCache.pageNum, pageNum)),
  })

  if (cached) {
    try {
      const parsed = JSON.parse(cached.data) as PagePayload
      const uniqueWords = extractUniqueWordsFromHtml(parsed.content)
      parsed.pageDictionary = await lookupWords(uniqueWords, book.language, userId)
      return json(parsed)
    }
    catch { }
  }

  const pageRow = await db.select({ content: schema.bookPages.content }).from(schema.bookPages).where(and(eq(schema.bookPages.bookId, bookId), eq(schema.bookPages.pageNum, pageNum))).get()
  if (!pageRow)
    throw new AppError(404, 'Страница не найдена')

  const { processedHtml, uniqueWords } = await runWorkerTask('tokenizeHtmlPage', { html: pageRow.content, language: book.language })
  const pageDictionary = await lookupWords(uniqueWords, book.language, userId)
  const payload: PagePayload = { bookId, pageNum, totalPages: book.totalPages, content: processedHtml, pageDictionary, type: 'epub' }

  await db.transaction(async (tx) => {
    await tx.delete(schema.nlpCache).where(and(eq(schema.nlpCache.bookId, bookId), eq(schema.nlpCache.pageNum, pageNum)))
    await tx.insert(schema.nlpCache).values({ bookId, pageNum, data: JSON.stringify(payload) })
  })

  return json(payload)
}

export async function handleLookupWord(req: Request, userId: number): Promise<Response> {
  const { id: bookId, word } = (req as any).params
  const book = await db.select({ language: schema.books.language }).from(schema.books).where(and(eq(schema.books.id, bookId), eq(schema.books.userId, userId))).get()
  const lang = book?.language || 'en'
  const entry = await lookupSingleWord(decodeURIComponent(word), lang, userId)
  if (!entry)
    throw new AppError(404, 'Слово не найдено в локальном словаре')
  return json(entry)
}

export async function handleAnalyzeSentence(req: Request, userId: number): Promise<Response> {
  llmLimiter(String(userId))

  const bookId = Number((req as any).params.id)

  const book = await db.select({ id: schema.books.id }).from(schema.books).where(and(eq(schema.books.id, bookId), eq(schema.books.userId, userId))).get()
  if (!book)
    throw new AppError(404, 'Книга не найдена')

  const { sentence, language } = AnalyzeSentenceSchema.parse(await req.json())

  const analysis = await analyzeSentence(bookId, sentence, language)
  return json(analysis)
}

export async function handleGenerateTts(req: Request, userId: number): Promise<Response> {
  llmLimiter(String(userId))

  const bookId = Number((req as any).params.id)
  const book = await db.query.books.findFirst({ where: and(eq(schema.books.id, bookId), eq(schema.books.userId, userId)), columns: { language: true } })
  if (!book)
    throw new AppError(404, 'Книга не найдена')

  const { text } = GenerateTtsSchema.parse(await req.json())

  const audioBase64 = await generateTts(text, book.language)
  return json({ audioBase64 })
}

export async function handleGetPageImage(req: Request): Promise<Response> {
  const { id: bookId, pageNum } = (req as any).params
  const pageRow = await db.select({ imageUrl: schema.mangaPages.imageUrl })
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
      'Cache-Control': 'public, max-age=31536000',
    },
  })
}
