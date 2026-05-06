import type { Book, PagePayload, UserDictItem } from '../types'
import { unlink } from 'node:fs/promises'
import { and, desc, eq } from 'drizzle-orm'
import { CORS_HEADERS } from '../config'
import { db } from '../db'
import * as schema from '../db/schema'
import { getUserDictionary, getWordFromUserDictionary, lookupSingleWord, lookupWords, removeFromUserDictionary, upsertToUserDictionary } from '../services/dictionary.service'
import { processEpub } from '../services/epub.service'
import { analyzeBookExcerpt, analyzeSentence, generateTts } from '../services/llm.service'
import { tokenizePage } from '../services/nlp.service'
import { AppError } from '../utils/errors'

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}

// GET /api/books
export async function handleGetBooks(): Promise<Response> {
  const books = await db.query.books.findMany({
    with: {
      progress: { columns: { currentPage: true } },
    },
    orderBy: [desc(schema.books.createdAt)],
  })

  const result = books.map(({ progress, ...book }) => ({
    ...book,
    currentPage: progress?.currentPage ?? null,
  }))

  return json(result)
}

// GET /api/books/:id/info
export async function handleGetBookInfo(req: Request): Promise<Response> {
  const id = Number((req as any).params.id)

  const book = await db.query.books.findFirst({
    where: eq(schema.books.id, id),
    with: {
      progress: { columns: { currentPage: true } },
      stats: true,
    },
  })

  if (!book)
    throw new AppError(404, 'Книга не найдена')

  const { progress, stats, ...bookData } = book

  const statsResult = stats ? { ...stats, tags: stats.tags ? JSON.parse(stats.tags) : [] } : null

  return json({
    ...bookData,
    currentPage: progress?.currentPage ?? null,
    toc: book.toc ? JSON.parse(book.toc) : [],
    stats: statsResult,
  })
}

// PATCH /api/books/:id
export async function handleUpdateBook(req: Request): Promise<Response> {
  const id = Number((req as any).params.id)
  const body = await req.json() as Partial<Book>

  await db.update(schema.books).set({
    title: body.title,
    author: body.author,
    coverBase64: body.coverBase64,
    language: body.language,
    createdAt: body.createdAt,
    updatedAt: new Date().toISOString(),
  }).where(eq(schema.books.id, id))

  if (typeof body.currentPage === 'number') {
    await db.insert(schema.readingProgress)
      .values({ bookId: id, currentPage: body.currentPage, updatedAt: new Date().toISOString() })
      .onConflictDoUpdate({
        target: schema.readingProgress.bookId,
        set: { currentPage: body.currentPage, updatedAt: new Date().toISOString() },
      })
  }

  return json({ success: true })
}

// POST /api/books/:id/analyze-book
export async function handleAnalyzeBookStats(req: Request): Promise<Response> {
  const id = Number((req as any).params.id)

  const book = await db.query.books.findFirst({ where: eq(schema.books.id, id) })
  if (!book)
    throw new AppError(404, 'Книга не найдена')

  const pages = await db.select({ content: schema.bookPages.content }).from(schema.bookPages).where(eq(schema.bookPages.bookId, id)).orderBy(schema.bookPages.pageNum)

  if (!pages.length)
    throw new AppError(400, 'Страницы для анализа не найдены')

  const fullText = pages.map(p => p.content).join('\n')
  const excerpt = fullText.substring(0, 3000)
  const aiData = await analyzeBookExcerpt(excerpt)

  const tagsJson = JSON.stringify(aiData.tags || [])
  let totalItems = 0; let uniqueItems = 0

  if (book.language === 'zh' || book.language === 'ja') {
    const allChars = fullText.match(/[\p{L}\p{N}]/gu) || []
    totalItems = allChars.length
    uniqueItems = new Set(allChars).size
  }
  else {
    const allWords = fullText.match(/[\p{L}\p{N}]+/gu) || []
    totalItems = allWords.length
    uniqueItems = new Set(allWords.map(w => w.toLowerCase())).size
  }

  await db.insert(schema.bookStats).values({
    bookId: id,
    description: aiData.description,
    difficulty: aiData.difficulty,
    tags: tagsJson,
    totalChars: totalItems,
    uniqueChars: uniqueItems,
  }).onConflictDoUpdate({
    target: schema.bookStats.bookId,
    set: {
      description: aiData.description,
      difficulty: aiData.difficulty,
      tags: tagsJson,
      totalChars: totalItems,
      uniqueChars: uniqueItems,
    },
  })

  const newStats = await db.query.bookStats.findFirst({ where: eq(schema.bookStats.bookId, id) })

  return json({ success: true, stats: { ...newStats, tags: JSON.parse(newStats?.tags || '[]') } })
}

// PATCH /api/books/:id/cover
export async function handleUpdateCover(req: Request): Promise<Response> {
  const id = Number((req as any).params.id)
  const formData = await req.formData()
  const file = formData.get('file') as File | null

  if (!file)
    throw new AppError(400, 'Файл не передан')

  const buffer = await file.arrayBuffer()
  const base64 = Buffer.from(buffer).toString('base64')
  const coverBase64 = `data:${file.type || 'image/jpeg'};base64,${base64}`

  await db.update(schema.books).set({ coverBase64 }).where(eq(schema.books.id, id))

  return json({ success: true, coverBase64 })
}

// PATCH /api/books/:id/stats
export async function handleUpdateStats(req: Request): Promise<Response> {
  const id = Number((req as any).params.id)
  const body = await req.json() as { description?: string, difficulty?: string, tags?: string[] }
  const tagsJson = JSON.stringify(body.tags || [])

  await db.insert(schema.bookStats).values({
    bookId: id,
    description: body.description || '',
    difficulty: body.difficulty || '',
    tags: tagsJson,
  }).onConflictDoUpdate({
    target: schema.bookStats.bookId,
    set: {
      description: body.description || '',
      difficulty: body.difficulty || '',
      tags: tagsJson,
    },
  })

  const stats = await db.query.bookStats.findFirst({ where: eq(schema.bookStats.bookId, id) })
  return json({ success: true, stats: { ...stats, tags: JSON.parse(stats?.tags || '[]') } })
}

// POST /api/books/upload
export async function handleUploadBook(req: Request): Promise<Response> {
  const formData = await req.formData()
  const file = formData.get('file') as File | null

  if (!file)
    throw new AppError(400, 'Файл не передан')
  if (!file.name.endsWith('.epub'))
    throw new AppError(400, 'Только .epub файлы')

  const bookId = await processEpub(await file.arrayBuffer(), file.name)
  const book = await db.query.books.findFirst({ where: eq(schema.books.id, bookId) })

  return json({ success: true, book })
}

// DELETE /api/books/:id
export async function handleDeleteBook(req: Request): Promise<Response> {
  const id = Number((req as any).params.id)

  // 1. Получаем информацию о книге, чтобы узнать путь к файлу
  const book = await db.query.books.findFirst({
    where: eq(schema.books.id, id),
    columns: { filePath: true },
  })

  if (!book) {
    throw new AppError(404, 'Книга не найдена')
  }

  // 2. Пытаемся физически удалить файл с диска
  try {
    if (book.filePath) {
      await unlink(book.filePath)
    }
  }
  catch (err: any) {
    // Если файла по какой-то причине уже нет на диске, просто логируем, но не прерываем удаление
    console.warn(`[File Delete Warning] Не удалось удалить файл ${book.filePath}:`, err.message)
  }

  // 3. Удаляем книгу из базы данных
  // Все связанные страницы (book_pages), статистика и прогресс удалятся автоматически
  // благодаря связи `onDelete: 'cascade'` в схеме БД.
  await db.delete(schema.books).where(eq(schema.books.id, id))

  return json({ success: true })
}

// GET /api/books/:id/toc
export async function handleGetToc(req: Request): Promise<Response> {
  const bookId = Number((req as any).params.id)
  const book = await db.select({ toc: schema.books.toc }).from(schema.books).where(eq(schema.books.id, bookId)).get()

  if (!book)
    throw new AppError(404, 'Книга не найдена')

  return json(book.toc ? JSON.parse(book.toc) : [])
}

// GET /api/books/:id/page/:pageNum
export async function handleGetPage(req: Request): Promise<Response> {
  const { id: bookId, pageNum } = (req as any).params

  const book = await db.select({ totalPages: schema.books.totalPages, language: schema.books.language })
    .from(schema.books)
    .where(eq(schema.books.id, bookId))
    .get()

  if (!book)
    throw new AppError(404, 'Книга не найдена')

  await db.insert(schema.readingProgress)
    .values({ bookId, currentPage: pageNum, updatedAt: new Date().toISOString() })
    .onConflictDoUpdate({ target: schema.readingProgress.bookId, set: { currentPage: pageNum } })

  const cached = await db.query.nlpCache.findFirst({
    where: and(eq(schema.nlpCache.bookId, bookId), eq(schema.nlpCache.pageNum, pageNum)),
  })

  if (cached)
    return json(JSON.parse(cached.data))

  const pageRow = await db.select({ content: schema.bookPages.content }).from(schema.bookPages).where(and(eq(schema.bookPages.bookId, bookId), eq(schema.bookPages.pageNum, pageNum))).get()

  if (!pageRow)
    throw new AppError(404, 'Страница не найдена')

  const sentences = await tokenizePage(pageRow.content, book.language)
  const allWords = new Set<string>()
  for (const s of sentences) {
    for (const t of s.tokens) {
      if (/[\p{L}\p{N}]/u.test(t.word))
        allWords.add(t.word)
    }
  }

  const pageDictionary = lookupWords([...allWords], book.language)
  const payload: PagePayload = { bookId, pageNum, totalPages: book.totalPages, content: sentences, pageDictionary }

  await db.insert(schema.nlpCache).values({ bookId, pageNum, data: JSON.stringify(payload) })

  return json(payload)
}

// GET /api/books/:id/word/:word
export async function handleLookupWord(req: Request): Promise<Response> {
  const { id: bookId, word } = (req as any).params
  const book = await db.select({ language: schema.books.language }).from(schema.books).where(eq(schema.books.id, bookId)).get()
  const lang = book?.language || 'en'
  const entry = lookupSingleWord(decodeURIComponent(word), lang)

  if (!entry)
    throw new AppError(404, 'Слово не найдено в локальном словаре')

  return json(entry)
}

// POST /api/books/:id/analyze
export async function handleAnalyzeSentence(req: Request): Promise<Response> {
  const { sentence, language } = await req.json() as { sentence: string, language: string }
  if (!sentence || !language)
    throw new AppError(400, 'Обязательны поля sentence и language')

  const analysis = await analyzeSentence(sentence, language)
  return json(analysis)
}

// GET /api/dictionary
export async function handleGetUserDict(): Promise<Response> {
  return json(getUserDictionary())
}

// POST /api/dictionary
export async function handleUpsertToUserDict(req: Request): Promise<Response> {
  const body = await req.json() as Omit<UserDictItem, 'id' | 'createdAt' | 'updatedAt'>
  upsertToUserDictionary(body)
  return json({ success: true })
}

// DELETE /api/dictionary/:word
export async function handleRemoveFromUserDict(req: Request): Promise<Response> {
  const word = (req as any).params.word
  removeFromUserDictionary(decodeURIComponent(word))
  return json({ success: true })
}

// GET /api/dictionary/:word
export async function handleGetWordFromUserDict(req: Request): Promise<Response> {
  const word = (req as any).params.word
  const entry = getWordFromUserDictionary(decodeURIComponent(word))
  if (!entry)
    throw new AppError(404, 'Слово не найдено в словаре пользователя')

  return json(entry)
}

// POST /api/books/:id/tts
export async function handleGenerateTts(req: Request): Promise<Response> {
  const bookId = Number((req as any).params.id)
  const book = await db.query.books.findFirst({ where: eq(schema.books.id, bookId), columns: { language: true } })

  if (!book)
    throw new AppError(404, 'Книга не найдена')

  const { text } = await req.json() as { text?: string }
  if (!text)
    throw new AppError(400, 'Текст не передан')

  const audioBase64 = await generateTts(text, book.language)
  return json({ audioBase64 })
}
