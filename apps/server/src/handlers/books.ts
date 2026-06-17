/// <reference types="bun-types" />

import type { PagePayload } from '../types'
import { mkdirSync, readFileSync } from 'node:fs'
import { rm, unlink } from 'node:fs/promises'
import path from 'node:path'
import { and, desc, eq, like, or, sql } from 'drizzle-orm'
import { parse as parseHtml } from 'node-html-parser'
import sharp from 'sharp'

import { AnalyzeBatchSchema, AnalyzeSentenceSchema, CheckCacheSchema, CreateCustomBookSchema, GenerateTtsSchema, GenerateTtsStandaloneSchema, UpdateBookSchema, UpdateStatsSchema } from '~/types/schemas'
import { extractLlmConfig, extractUniqueWordsFromHtml, json, normalizeLanguageCode } from '~/utils/helpers'
import { BOOKS_PATH, CORS_HEADERS, COVERS_PATH } from '../config'
import { db } from '../db'
import * as schema from '../db/schema'
import { lookupSingleWord, lookupWords } from '../services/dictionary.service'
import { checkBookLimit } from '../services/limits.service'
import { analyzeBatch, analyzeBookExcerpt, analyzeMangaInfo, analyzeSentence, checkCacheBatch, generateTts } from '../services/llm.service'
import { recognizeMangaPage } from '../services/ocr.service'
import { AppError } from '../utils/errors'
import { createRateLimiter } from '../utils/rate-limit'
import { runWorkerTask } from '../workers/worker-client'

const bookAiLimiter = createRateLimiter(10, 60 * 1000)

export async function handleGetBooks(req: Request, userId: number | null): Promise<Response> {
  const url = new URL(req.url)
  const tab = url.searchParams.get('tab') || 'my'

  if (tab === 'public') {
    const page = Math.max(1, Number.parseInt(url.searchParams.get('page') || '1'))
    const limit = Math.max(1, Number.parseInt(url.searchParams.get('limit') || '20'))
    const tag = url.searchParams.get('tag')
    const search = url.searchParams.get('search')
    const language = url.searchParams.get('lang')

    const conditions = [eq(schema.books.isPublic, true)]

    const baseQuery = db.select({
      book: schema.books,
      stats: schema.bookStats,
      progress: schema.readingProgress,
    })
      .from(schema.books)
      .leftJoin(schema.bookStats, eq(schema.books.id, schema.bookStats.bookId))
      .leftJoin(schema.readingProgress, and(
        eq(schema.readingProgress.bookId, schema.books.id),
        userId ? eq(schema.readingProgress.userId, userId) : sql`1=0`,
      ))

    if (tag && tag !== 'all') {
      conditions.push(like(schema.bookStats.tags, `%"${tag}"%`))
    }
    if (search) {
      conditions.push(like(schema.books.title, `%${search}%`))
    }
    if (language && language !== 'all') {
      conditions.push(eq(schema.books.language, normalizeLanguageCode(language)))
    }

    const totalRes = await db.select({ count: sql<number>`count(*)` })
      .from(schema.books)
      .leftJoin(schema.bookStats, eq(schema.books.id, schema.bookStats.bookId))
      .where(and(...conditions))
      .get()
    const total = totalRes?.count || 0

    const rows = await baseQuery
      .where(and(...conditions))
      .orderBy(desc(schema.books.createdAt))
      .limit(limit)
      .offset((page - 1) * limit)

    const data = rows.map(r => ({
      ...r.book,
      stats: r.stats ? { ...r.stats, tags: JSON.parse(r.stats.tags || '[]') } : null,
      currentPage: r.progress?.currentPage ?? null,
      status: r.progress?.status ?? 'reading',
      isFavorite: r.progress?.isFavorite ?? false,
      collection: r.progress?.collection ?? null,
      progressUpdatedAt: r.progress?.updatedAt ?? null,
    }))

    return json({ data, total, page, limit })
  }

  if (!userId) {
    throw new AppError(401, 'Необходима авторизация')
  }

  // Мои книги
  const allBooks = await db.query.books.findMany({
    where: or(
      eq(schema.books.userId, userId),
      eq(schema.books.isPublic, true),
    ),
    with: { progresses: { where: eq(schema.readingProgress.userId, userId), limit: 1 } },
    orderBy: [desc(schema.books.updatedAt)],
  })

  const result = allBooks
    .filter(b => b.userId === userId || b.progresses.length > 0)
    .map((book) => {
      const progress = book.progresses[0]
      const { progresses, ...bookData } = book
      return {
        ...bookData,
        currentPage: progress?.currentPage ?? null,
        status: progress?.status ?? 'reading',
        isFavorite: progress?.isFavorite ?? false,
        collection: progress?.collection ?? null,
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

export async function handleGetBookInfo(req: Request, userId: number | null): Promise<Response> {
  const id = Number(req.params.id)

  let condition
  if (userId) {
    condition = and(
      eq(schema.books.id, id),
      or(eq(schema.books.userId, userId), eq(schema.books.isPublic, true)),
    )
  }
  else {
    condition = and(
      eq(schema.books.id, id),
      eq(schema.books.isPublic, true),
    )
  }

  const book = await db.query.books.findFirst({
    where: condition,
    with: {
      progresses: userId ? { where: eq(schema.readingProgress.userId, userId), limit: 1 } : undefined,
      stats: true,
    },
  })

  if (!book)
    throw new AppError(404, 'Книга не найдена или доступ закрыт')

  const progress = book.progresses ? book.progresses[0] : null
  const { progresses, stats, ...bookData } = book
  const statsResult = stats
    ? {
        ...stats,
        tags: stats.tags ? JSON.parse(stats.tags) : [],
        posDistribution: stats.posDistribution ? JSON.parse(stats.posDistribution) : null,
        topWords: stats.topWords ? JSON.parse(stats.topWords) : null,
      }
    : null

  return json({
    ...bookData,
    currentPage: progress?.currentPage ?? null,
    status: progress?.status ?? 'reading',
    isFavorite: progress?.isFavorite ?? false,
    collection: progress?.collection ?? null,
    toc: book.toc ? JSON.parse(book.toc) : [],
    stats: statsResult,
  }, 200, {
    'Cache-Control': 'private, stale-while-revalidate=60',
  })
}

export async function handleStartReading(req: Request, userId: number): Promise<Response> {
  const id = Number(req.params.id)
  const book = await db.query.books.findFirst({ where: eq(schema.books.id, id) })
  if (!book)
    throw new AppError(404, 'Книга не найдена')
  if (!book.isPublic && book.userId !== userId)
    throw new AppError(403, 'Нет доступа')

  await db.insert(schema.readingProgress).values({
    bookId: id,
    userId,
    currentPage: 1,
    status: 'reading',
    isFavorite: false,
    collection: null,
    updatedAt: new Date().toISOString(),
  }).onConflictDoNothing()

  return json({ success: true })
}

export async function handleAnalyzeVocabulary(req: Request, userId: number): Promise<Response> {
  bookAiLimiter(String(userId))
  const id = Number(req.params.id)
  const book = await db.query.books.findFirst({ where: eq(schema.books.id, id) })
  if (!book || book.userId !== userId)
    throw new AppError(403, 'Нет доступа')

  if (book.type === 'manga') {
    throw new AppError(400, 'Лексический анализ пока недоступен для манги')
  }

  const result = await runWorkerTask('analyzeBookVocabulary', { bookId: id, language: normalizeLanguageCode(book.language) })

  await db.insert(schema.bookStats).values({
    bookId: id,
    posDistribution: JSON.stringify(result.posDistribution),
    topWords: JSON.stringify(result.topWords),
    lexicalDiversity: result.lexicalDiversity,
  }).onConflictDoUpdate({
    target: schema.bookStats.bookId,
    set: {
      posDistribution: JSON.stringify(result.posDistribution),
      topWords: JSON.stringify(result.topWords),
      lexicalDiversity: result.lexicalDiversity,
    },
  })

  return json({ success: true, lexicalStats: result })
}

export async function handleUpdateBook(req: Request, userId: number): Promise<Response> {
  const id = Number(req.params.id)
  const body = UpdateBookSchema.parse(await req.json())

  const book = await db.query.books.findFirst({ where: eq(schema.books.id, id) })
  if (!book)
    throw new AppError(404, 'Книга не найдена')

  if (book.userId !== userId && !book.isPublic) {
    throw new AppError(404, 'Книга не найдена или доступ закрыт')
  }

  const metadataKeys = ['title', 'author', 'coverUrl', 'language', 'series', 'seriesNumber', 'createdAt', 'isPublic', 'textDirection']
  const hasMetadataChanges = metadataKeys.some(key => body[key as keyof typeof body] !== undefined)

  if (hasMetadataChanges && book.userId === userId) {
    await db.update(schema.books).set({
      title: body.title,
      author: body.author,
      coverUrl: body.coverUrl,
      language: body.language ? normalizeLanguageCode(body.language) : undefined,
      series: body.series,
      seriesNumber: body.seriesNumber,
      createdAt: body.createdAt,
      isPublic: body.isPublic,
      textDirection: body.textDirection,
      updatedAt: new Date().toISOString(),
    }).where(eq(schema.books.id, id))
  }

  const progressKeys = ['currentPage', 'status', 'isFavorite', 'collection']
  const hasProgressChanges = progressKeys.some(key => body[key as keyof typeof body] !== undefined)

  if (hasProgressChanges) {
    const updatePayload: any = { updatedAt: new Date().toISOString() }
    if (body.currentPage !== undefined)
      updatePayload.currentPage = body.currentPage
    if (body.status !== undefined)
      updatePayload.status = body.status
    if (body.isFavorite !== undefined)
      updatePayload.isFavorite = body.isFavorite
    if (body.collection !== undefined)
      updatePayload.collection = body.collection

    await db.insert(schema.readingProgress).values({
      bookId: id,
      userId,
      currentPage: body.currentPage ?? 1,
      status: body.status ?? 'reading',
      isFavorite: body.isFavorite ?? false,
      collection: body.collection ?? null,
      updatedAt: new Date().toISOString(),
    }).onConflictDoUpdate({
      target: [schema.readingProgress.bookId, schema.readingProgress.userId],
      set: updatePayload,
    })
  }

  return json({ success: true })
}

export async function handleAnalyzeBookStats(req: Request, userId: number): Promise<Response> {
  bookAiLimiter(String(userId))
  const config = extractLlmConfig(req)

  const id = Number(req.params.id)
  const book = await db.query.books.findFirst({ where: eq(schema.books.id, id) })
  if (!book || book.userId !== userId)
    throw new AppError(403, 'Нет доступа')

  let aiData
  let totalItems = 0
  const uniqueSet = new Set<string>()

  if (book.type === 'manga') {
    aiData = await analyzeMangaInfo(userId, book.title, book.author, normalizeLanguageCode(book.language), config)
  }
  else {
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

    aiData = await analyzeBookExcerpt(userId, excerpt, config)

    const normLang = normalizeLanguageCode(book.language)
    for (const p of pages) {
      const plainText = parseHtml(p.content).textContent
      if (normLang === 'zh' || normLang === 'ja') {
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
  }

  const tagsJson = JSON.stringify(aiData.tags || [])
  const descriptionJson = typeof aiData.description === 'string' ? aiData.description : JSON.stringify(aiData.description || {})

  await db.insert(schema.bookStats).values({
    bookId: id,
    description: descriptionJson,
    difficulty: aiData.difficulty,
    tags: tagsJson,
    totalChars: totalItems,
    uniqueChars: uniqueSet.size,
  }).onConflictDoUpdate({
    target: schema.bookStats.bookId,
    set: {
      description: descriptionJson,
      difficulty: aiData.difficulty,
      tags: tagsJson,
      totalChars: totalItems,
      uniqueChars: uniqueSet.size,
    },
  })

  const newStats = await db.query.bookStats.findFirst({ where: eq(schema.bookStats.bookId, id) })
  return json({ success: true, stats: newStats ? { ...newStats, tags: newStats.tags ? JSON.parse(newStats.tags) : [], posDistribution: newStats.posDistribution ? JSON.parse(newStats.posDistribution) : null, topWords: newStats.topWords ? JSON.parse(newStats.topWords) : null } : null })
}

export async function handleUpdateCover(req: Request, userId: number): Promise<Response> {
  const id = Number(req.params.id)

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
  const filename = req.params.filename
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
  const id = Number(req.params.id)
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
  await checkBookLimit(userId)

  const formData = await req.formData()
  const file = formData.get('file') as File | null

  if (!file) {
    throw new AppError(400, 'Файл не передан')
  }

  const MAX_FILE_SIZE = 5000 * 1024 * 1024 // 5 ГБ
  if (file.size > MAX_FILE_SIZE) {
    throw new AppError(413, `Размер файла превышает лимит в 5 ГБ. Ваш файл: ${(file.size / 1024 / 1024).toFixed(2)} МБ`)
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

export async function handleCreateCustomBook(req: Request, userId: number): Promise<Response> {
  await checkBookLimit(userId)

  const body = CreateCustomBookSchema.parse(await req.json())

  const safeName = `${Date.now()}_custom_manga`
  const filePath = path.join(BOOKS_PATH, safeName)

  mkdirSync(filePath, { recursive: true })

  const [insertedBook] = await db.insert(schema.books).values({
    userId,
    type: body.type,
    title: body.title,
    author: body.author || null,
    filePath,
    language: normalizeLanguageCode(body.language),
    totalPages: 0,
    toc: '[]',
  }).returning()

  await db.insert(schema.readingProgress).values({
    bookId: insertedBook.id,
    userId,
    currentPage: 1,
  }).onConflictDoNothing()

  return json({ success: true, book: insertedBook })
}

export async function handleAppendMangaChapter(req: Request, userId: number): Promise<Response> {
  const id = Number(req.params.id)
  const formData = await req.formData()

  const chapterTitle = formData.get('chapterTitle') as string || ''
  const files = formData.getAll('files') as File[]

  if (!files.length) {
    throw new AppError(400, 'Файлы не переданы')
  }

  const book = await db.query.books.findFirst({ where: eq(schema.books.id, id) })
  if (!book || book.userId !== userId) {
    throw new AppError(403, 'Нет доступа к книге')
  }

  const { appendMangaChapter } = await import('../services/manga.service')
  await appendMangaChapter(book, chapterTitle, files)

  const updatedBook = await db.query.books.findFirst({ where: eq(schema.books.id, id) })
  return json({ success: true, book: updatedBook })
}

export async function handleDeleteBook(req: Request, userId: number): Promise<Response> {
  const id = Number(req.params.id)
  const book = await db.query.books.findFirst({ where: eq(schema.books.id, id), columns: { filePath: true, coverUrl: true, userId: true } })
  if (!book)
    throw new AppError(404, 'Книга не найдена')

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
  const bookId = Number(req.params.id)
  const book = await db.query.books.findFirst({ where: eq(schema.books.id, bookId), columns: { toc: true, userId: true, isPublic: true } })

  if (!book || (book.userId !== userId && !book.isPublic))
    throw new AppError(403, 'Нет доступа к книге')

  return json(book.toc ? JSON.parse(book.toc) : [], 200, {
    'Cache-Control': 'private, stale-while-revalidate=60',
  })
}

// ------------------------------------------------------------------
// Выдача СТАТИЧЕСКОЙ страницы (без персонализированного словаря)
// ------------------------------------------------------------------
export async function handleGetPage(req: Request, userId: number): Promise<Response> {
  const { id: bookIdStr, pageNum: pageNumStr } = req.params
  const bookId = Number(bookIdStr)
  const pageNum = Number(pageNumStr)
  const url = new URL(req.url)
  const isSync = url.searchParams.get('sync') === 'true'

  const book = db.select({
    totalPages: schema.books.totalPages,
    language: schema.books.language,
    type: schema.books.type,
    userId: schema.books.userId,
    isPublic: schema.books.isPublic,
    textDirection: schema.books.textDirection,
  })
    .from(schema.books)
    .where(eq(schema.books.id, bookId))
    .get()

  if (!book)
    throw new AppError(404, 'Книга не найдена')

  const bookLang = normalizeLanguageCode(book.language)
  if (book.userId !== userId && !book.isPublic)
    throw new AppError(403, 'Нет доступа к книге')

  if (!isSync) {
    await db.insert(schema.readingProgress)
      .values({
        bookId,
        userId,
        currentPage: pageNum,
        status: 'reading',
        isFavorite: false,
        collection: null,
        updatedAt: new Date().toISOString(),
      })
      .onConflictDoUpdate({
        target: [schema.readingProgress.bookId, schema.readingProgress.userId],
        set: { currentPage: pageNum, updatedAt: new Date().toISOString() },
      })
  }

  if (book.type === 'manga') {
    const pageRow = db.select().from(schema.mangaPages).where(and(eq(schema.mangaPages.bookId, bookId), eq(schema.mangaPages.pageNum, pageNum))).get()
    if (!pageRow)
      throw new AppError(404, 'Страница манги не найдена')

    let ocrBlocks = pageRow.ocrData ? JSON.parse(pageRow.ocrData) : null

    if (ocrBlocks === null && pageRow.imageUrl) {
      try {
        const config = extractLlmConfig(req)
        const fileBuffer = readFileSync(pageRow.imageUrl)
        let base64 = ''

        const ext = path.extname(pageRow.imageUrl).toLowerCase()
        const isSupportedOCR = ['.jpg', '.jpeg', '.png', '.pdf'].includes(ext)
        const isTooLarge = fileBuffer.byteLength > 9.5 * 1024 * 1024

        if (!isSupportedOCR || isTooLarge) {
          const optimizedBuffer = await sharp(fileBuffer)
            .resize({ width: 3000, height: 4000, fit: 'inside', withoutEnlargement: true })
            .jpeg({ quality: 80 })
            .toBuffer()
          base64 = optimizedBuffer.toString('base64')
        }
        else {
          base64 = fileBuffer.toString('base64')
        }

        ocrBlocks = await recognizeMangaPage(userId, base64, bookLang, book.textDirection || undefined, config)

        await db.update(schema.mangaPages).set({ ocrData: JSON.stringify(ocrBlocks) }).where(eq(schema.mangaPages.id, pageRow.id))
      }
      catch (e: any) {
        console.error('OCR Error:', e.message)
        ocrBlocks = []
      }
    }

    if (ocrBlocks && ocrBlocks.length > 0) {
      const { processedBlocks } = await runWorkerTask('tokenizeOcrBlocks', { blocks: ocrBlocks, language: bookLang })
      ocrBlocks = processedBlocks
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
    }, 200, { 'Cache-Control': 'public, max-age=86400' })
  }

  // Остальная часть handleGetPage для ePub/Text...
  const cached = await db.query.nlpCache.findFirst({
    where: and(eq(schema.nlpCache.bookId, bookId), eq(schema.nlpCache.pageNum, pageNum)),
  })

  if (cached) {
    try {
      const parsed = JSON.parse(cached.data) as PagePayload
      delete parsed.pageDictionary
      return json(parsed, 200, { 'Cache-Control': 'public, max-age=86400' })
    }
    catch { }
  }

  const pageRow = db.select({ content: schema.bookPages.content }).from(schema.bookPages).where(and(eq(schema.bookPages.bookId, bookId), eq(schema.bookPages.pageNum, pageNum))).get()
  if (!pageRow)
    throw new AppError(404, 'Страница не найдена')

  const { processedHtml } = await runWorkerTask('tokenizeHtmlPage', { html: pageRow.content, language: bookLang })
  const payload: PagePayload = { bookId, pageNum, totalPages: book.totalPages, content: processedHtml, type: 'epub' }

  await db.transaction(async (tx) => {
    await tx.delete(schema.nlpCache).where(and(eq(schema.nlpCache.bookId, bookId), eq(schema.nlpCache.pageNum, pageNum)))
    await tx.insert(schema.nlpCache).values({ bookId, pageNum, data: JSON.stringify(payload) })
  })

  return json(payload, 200, { 'Cache-Control': 'public, max-age=86400' })
}

export async function handleGetPageDictionary(req: Request, userId: number): Promise<Response> {
  const { id: bookIdStr, pageNum: pageNumStr } = req.params
  const bookId = Number(bookIdStr)
  const pageNum = Number(pageNumStr)
  const targetLang = normalizeLanguageCode(req.headers.get('Accept-Language') || 'ru')

  const book = await db.query.books.findFirst({
    where: eq(schema.books.id, bookId),
    columns: { language: true, type: true, userId: true, isPublic: true },
  })
  if (!book)
    throw new AppError(404, 'Книга не найдена')
  if (book.userId !== userId && !book.isPublic)
    throw new AppError(403, 'Нет доступа к книге')

  let uniqueWords: string[] = []
  const bookLang = normalizeLanguageCode(book.language)

  if (book.type === 'manga') {
    const pageRow = await db.query.mangaPages.findFirst({
      where: and(eq(schema.mangaPages.bookId, bookId), eq(schema.mangaPages.pageNum, pageNum)),
    })
    const ocrBlocks = pageRow?.ocrData ? JSON.parse(pageRow.ocrData) : []
    if (ocrBlocks && ocrBlocks.length > 0) {
      const { uniqueWords: ocrWords } = await runWorkerTask('tokenizeOcrBlocks', { blocks: ocrBlocks, language: bookLang })
      uniqueWords = ocrWords
    }
  }
  else {
    const cached = await db.query.nlpCache.findFirst({
      where: and(eq(schema.nlpCache.bookId, bookId), eq(schema.nlpCache.pageNum, pageNum)),
    })
    if (cached) {
      const parsed = JSON.parse(cached.data) as PagePayload
      uniqueWords = extractUniqueWordsFromHtml(parsed.content)
    }
    else {
      const pageRow = await db.query.bookPages.findFirst({
        where: and(eq(schema.bookPages.bookId, bookId), eq(schema.bookPages.pageNum, pageNum)),
      })
      if (pageRow) {
        const { uniqueWords: epWords } = await runWorkerTask('tokenizeHtmlPage', { html: pageRow.content, language: bookLang })
        uniqueWords = epWords
      }
    }
  }

  const pageDictionary = await lookupWords(uniqueWords, bookLang, targetLang, userId)

  return json({ pageDictionary }, 200, { 'Cache-Control': 'private, max-age=86400' })
}

export async function handleLookupWord(req: Request, userId: number): Promise<Response> {
  const bookId = Number(req.params.id)
  const word = req.params.word
  const targetLang = normalizeLanguageCode(req.headers.get('Accept-Language') || 'ru')
  const book = await db.query.books.findFirst({ where: eq(schema.books.id, bookId), columns: { language: true, userId: true, isPublic: true } })
  if (!book || (book.userId !== userId && !book.isPublic))
    throw new AppError(403, 'Нет доступа')

  const lang = normalizeLanguageCode(book.language || 'en')
  const entry = await lookupSingleWord(decodeURIComponent(word), lang, targetLang, userId)
  if (!entry)
    throw new AppError(404, 'Слово не найдено в локальном словаре')
  return json(entry)
}

export async function handleCheckCache(req: Request, userId: number): Promise<Response> {
  const bookId = Number(req.params.id)
  const book = await db.query.books.findFirst({ where: eq(schema.books.id, bookId), columns: { id: true, userId: true, isPublic: true } })
  if (!book || (book.userId !== userId && !book.isPublic))
    throw new AppError(403, 'Нет доступа')

  const targetLang = normalizeLanguageCode(req.headers.get('Accept-Language') || 'ru')
  const { items, language } = CheckCacheSchema.parse(await req.json())

  const results = await checkCacheBatch(bookId, items, normalizeLanguageCode(language), targetLang)
  return json({ results })
}

export async function handleAnalyzeSentence(req: Request, userId: number): Promise<Response> {
  const config = extractLlmConfig(req)

  const bookId = Number(req.params.id)
  const book = await db.query.books.findFirst({ where: eq(schema.books.id, bookId), columns: { id: true, userId: true, isPublic: true } })
  if (!book || (book.userId !== userId && !book.isPublic))
    throw new AppError(403, 'Нет доступа')

  const { sentence, language, context, targetLanguage } = AnalyzeSentenceSchema.parse(await req.json())
  const finalTargetLang = normalizeLanguageCode(targetLanguage || req.headers.get('Accept-Language') || 'ru')
  const analysis = await analyzeSentence(
    userId,
    bookId,
    sentence,
    normalizeLanguageCode(language),
    finalTargetLang,
    config,
    context,
  )

  return json(analysis)
}

export async function handleGenerateTts(req: Request, userId: number): Promise<Response> {
  const config = extractLlmConfig(req)

  const bookId = Number(req.params.id)
  const book = await db.query.books.findFirst({ where: eq(schema.books.id, bookId), columns: { language: true, userId: true, isPublic: true } })
  if (!book || (book.userId !== userId && !book.isPublic))
    throw new AppError(403, 'Нет доступа')

  const { text } = GenerateTtsSchema.parse(await req.json())
  const audioBase64 = await generateTts(userId, text, normalizeLanguageCode(book.language), config)
  return json({ audioBase64 })
}

export async function handleStandaloneTts(req: Request, userId: number): Promise<Response> {
  const config = extractLlmConfig(req)

  const { text, language } = GenerateTtsStandaloneSchema.parse(await req.json())
  const audioBase64 = await generateTts(userId, text, normalizeLanguageCode(language), config)
  return json({ audioBase64 })
}

export async function handleGetPageImage(req: Request): Promise<Response> {
  const bookId = Number(req.params.id)
  const pageNum = Number(req.params.pageNum)
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

export async function handleAnalyzeBatch(req: Request, userId: number): Promise<Response> {
  const config = extractLlmConfig(req)
  const bookId = Number(req.params.id)

  const book = await db.query.books.findFirst({ where: eq(schema.books.id, bookId) })
  if (!book || (book.userId !== userId && !book.isPublic))
    throw new AppError(403, 'Нет доступа')

  const { items, language, targetLanguage } = AnalyzeBatchSchema.parse(await req.json())
  const finalTargetLang = normalizeLanguageCode(targetLanguage || req.headers.get('Accept-Language') || 'ru')
  const results = await analyzeBatch(userId, bookId, items, normalizeLanguageCode(language), finalTargetLang, config)

  return json({ results })
}
