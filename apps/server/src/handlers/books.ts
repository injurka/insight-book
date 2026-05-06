import type { Book, PagePayload, UserDictItem } from '../types'
import { CORS_HEADERS } from '../config'
import { db } from '../db'
import { getUserDictionary, getWordFromUserDictionary, lookupSingleWord, lookupWords, removeFromUserDictionary, upsertToUserDictionary } from '../services/dictionary.service'
import { processEpub } from '../services/epub.service'
import { analyzeBookExcerpt, analyzeSentence, generateTts } from '../services/llm.service'
import { tokenizePage } from '../services/nlp.service'

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}

// GET /api/books
export function handleGetBooks(): Response {
  const books = db.prepare(`
    SELECT b.*, rp.currentPage
    FROM books b
    LEFT JOIN reading_progress rp ON rp.bookId = b.id
    ORDER BY b.createdAt DESC
  `).all()
  return json(books)
}

// GET /api/books/:id/info
export function handleGetBookInfo(id: number): Response {
  const book = db.prepare(`
    SELECT b.*, rp.currentPage 
    FROM books b 
    LEFT JOIN reading_progress rp ON rp.bookId = b.id 
    WHERE b.id = ?
  `).get(id) as any

  if (!book)
    return json({ error: 'Книга не найдена' }, 404)

  const statsRow = db.prepare(`SELECT * FROM book_stats WHERE bookId = ?`).get(id) as any

  if (statsRow && statsRow.tags) {
    statsRow.tags = JSON.parse(statsRow.tags)
  }

  return json({
    ...book,
    toc: book.toc ? JSON.parse(book.toc) : [],
    stats: statsRow || null,
  })
}

// PATCH /api/books/:id (Основная информация)
export async function handleUpdateBook(req: Request, id: number): Promise<Response> {
  try {
    const body = await req.json() as Partial<Book>

    db.prepare(`
      UPDATE books
      SET title = COALESCE(?, title),
          author = COALESCE(?, author),
          coverBase64 = COALESCE(?, coverBase64),
          language = COALESCE(?, language),
          createdAt = COALESCE(?, createdAt)
      WHERE id = ?
    `).run(
      body.title !== undefined ? body.title : null,
      body.author !== undefined ? body.author : null,
      body.coverBase64 !== undefined ? body.coverBase64 : null,
      body.language !== undefined ? body.language : null,
      body.createdAt !== undefined ? body.createdAt : null,
      id,
    )

    if (body.currentPage !== undefined) {
      db.prepare(`
        INSERT INTO reading_progress (bookId, currentPage, updatedAt)
        VALUES (?, ?, datetime('now'))
        ON CONFLICT(bookId) DO UPDATE SET 
          currentPage = excluded.currentPage,
          updatedAt = datetime('now')
      `).run(id, body.currentPage)
    }

    return json({ success: true })
  }
  catch (e: any) {
    return json({ error: e.message }, 500)
  }
}

// POST /api/books/:id/analyze-book
export async function handleAnalyzeBookStats(id: number): Promise<Response> {
  try {
    const book = db.prepare(`SELECT * FROM books WHERE id = ?`).get(id) as Book | null
    if (!book)
      return json({ error: 'Книга не найдена' }, 404)

    const pages = db.prepare(`SELECT content FROM book_pages WHERE bookId = ? ORDER BY pageNum ASC`).all(id) as { content: string }[]
    if (!pages.length)
      return json({ error: 'Страницы не найдены' }, 400)

    const fullText = pages.map(p => p.content).join('\n')

    const bookLanguage = book.language || 'en'
    let totalItems = 0
    let uniqueItems = 0

    if (bookLanguage === 'zh' || bookLanguage === 'ja') {
      const charRegex = /[\p{L}\p{N}]/gu
      const allChars = fullText.match(charRegex) || []
      totalItems = allChars.length
      uniqueItems = new Set(allChars).size
    }
    else {
      const wordRegex = /[\p{L}\p{N}]+/gu
      const allWords = fullText.match(wordRegex) || []
      totalItems = allWords.length
      uniqueItems = new Set(allWords.map(w => w.toLowerCase())).size
    }

    const excerpt = fullText.substring(0, 3000)
    const aiData = await analyzeBookExcerpt(excerpt)

    const tagsJson = JSON.stringify(aiData.tags || [])

    db.prepare(`
      INSERT INTO book_stats (bookId, description, difficulty, tags, totalChars, uniqueChars, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(bookId) DO UPDATE SET
        description = excluded.description,
        difficulty = excluded.difficulty,
        tags = excluded.tags,
        totalChars = excluded.totalChars,
        uniqueChars = excluded.uniqueChars
    `).run(id, aiData.description, aiData.difficulty, tagsJson, totalItems, uniqueItems)

    const newStats = db.prepare(`SELECT * FROM book_stats WHERE bookId = ?`).get(id) as any
    newStats.tags = JSON.parse(newStats.tags)

    return json({ success: true, stats: newStats })
  }
  catch (e: any) {
    return json({ error: e.message }, 500)
  }
}

// PATCH /api/books/:id/cover
export async function handleUpdateCover(req: Request, id: number): Promise<Response> {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file)
      return json({ error: 'Файл не передан' }, 400)

    const buffer = await file.arrayBuffer()
    const base64 = Buffer.from(buffer).toString('base64')
    const mimeType = file.type || 'image/jpeg'
    const coverBase64 = `data:${mimeType};base64,${base64}`

    db.prepare(`UPDATE books SET coverBase64 = ? WHERE id = ?`).run(coverBase64, id)

    return json({ success: true, coverBase64 })
  }
  catch (e: any) {
    return json({ error: e.message }, 500)
  }
}

// PATCH /api/books/:id/stats
export async function handleUpdateStats(req: Request, id: number): Promise<Response> {
  try {
    const body = await req.json() as { description?: string, difficulty?: string, tags?: string[] }
    const tagsJson = JSON.stringify(body.tags || [])

    db.prepare(`
      INSERT INTO book_stats (bookId, description, difficulty, tags, totalChars, uniqueChars, createdAt)
      VALUES (?, ?, ?, ?, 0, 0, datetime('now'))
      ON CONFLICT(bookId) DO UPDATE SET
        description = excluded.description,
        difficulty = excluded.difficulty,
        tags = excluded.tags
    `).run(id, body.description || '', body.difficulty || '', tagsJson)

    const stats = db.prepare(`SELECT * FROM book_stats WHERE bookId = ?`).get(id) as any
    stats.tags = JSON.parse(stats.tags)

    return json({ success: true, stats })
  }
  catch (e: any) {
    return json({ error: e.message }, 500)
  }
}

// POST /api/books/upload
export async function handleUploadBook(req: Request): Promise<Response> {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file)
      return json({ error: 'Файл не передан' }, 400)
    if (!file.name.endsWith('.epub'))
      return json({ error: 'Только .epub файлы' }, 400)

    const buffer = await file.arrayBuffer()
    const bookId = await processEpub(buffer, file.name)
    const book = db.prepare(`SELECT * FROM books WHERE id = ?`).get(bookId)
    return json({ success: true, book })
  }
  catch (e: any) {
    return json({ error: e.message }, 500)
  }
}

// DELETE /api/books/:id
export function handleDeleteBook(id: number): Response {
  db.prepare(`DELETE FROM books WHERE id = ?`).run(id)
  return json({ success: true })
}

// GET /api/books/:id/toc
export function handleGetToc(bookId: number): Response {
  const book = db.prepare(`SELECT toc FROM books WHERE id = ?`).get(bookId) as { toc: string | null } | null
  if (!book)
    return json({ error: 'Книга не найдена' }, 404)
  if (!book.toc)
    return json([])
  return json(JSON.parse(book.toc))
}

// GET /api/books/:id/page/:pageNum
export async function handleGetPage(bookId: number, pageNum: number): Promise<Response> {
  const book = db.prepare(`SELECT totalPages, language FROM books WHERE id = ?`).get(bookId) as { totalPages: number, language: string } | null
  if (!book)
    return json({ error: 'Книга не найдена' }, 404)

  db.prepare(`
    UPDATE reading_progress SET currentPage = ?, updatedAt = datetime('now')
    WHERE bookId = ?
  `).run(pageNum, bookId)

  const cached = db.prepare(`
    SELECT data FROM nlp_cache WHERE bookId = ? AND pageNum = ?
  `).get(bookId, pageNum) as { data: string } | null

  if (cached) {
    return json(JSON.parse(cached.data))
  }

  const pageRow = db.prepare(`
    SELECT content FROM book_pages WHERE bookId = ? AND pageNum = ?
  `).get(bookId, pageNum) as { content: string } | null

  if (!pageRow)
    return json({ error: 'Страница не найдена' }, 404)

  const sentences = await tokenizePage(pageRow.content, book.language)

  const allWords = new Set<string>()
  for (const s of sentences) {
    for (const t of s.tokens) {
      if (/[\p{L}\p{N}]/u.test(t.word))
        allWords.add(t.word)
    }
  }

  const pageDictionary = lookupWords([...allWords], book.language)

  const payload: PagePayload = {
    bookId,
    pageNum,
    totalPages: book.totalPages,
    content: sentences,
    pageDictionary,
  }

  db.prepare(`
    INSERT OR REPLACE INTO nlp_cache (bookId, pageNum, data)
    VALUES (?, ?, ?)
  `).run(bookId, pageNum, JSON.stringify(payload))

  return json(payload)
}

// GET /api/books/:id/word/:word
export function handleLookupWord(bookId: number, word: string): Response {
  const book = db.prepare(`SELECT language FROM books WHERE id = ?`).get(bookId) as { language: string } | null
  const lang = book ? book.language : 'en'

  const entry = lookupSingleWord(decodeURIComponent(word), lang)

  if (!entry)
    return json({ error: 'Слово не найдено в локальном словаре' }, 404)

  return json(entry)
}

// POST /api/books/:id/analyze
export async function handleAnalyzeSentence(req: Request): Promise<Response> {
  try {
    const body = await req.json() as { sentence: string, language: string }
    if (!body.sentence || !body.language)
      return json({ error: 'Обязательны поля sentence и language' }, 400)
    const analysis = await analyzeSentence(body.sentence, body.language)
    return json(analysis)
  }
  catch (e: any) {
    return json({ error: e.message }, 500)
  }
}

// GET /api/dictionary
export function handleGetUserDict(): Response {
  return json(getUserDictionary())
}

// POST /api/dictionary
export async function handleUpsertToUserDict(req: Request): Promise<Response> {
  const body = await req.json() as Omit<UserDictItem, 'id' | 'createdAt' | 'updatedAt'>
  upsertToUserDictionary(body)
  return json({ success: true })
}

// DELETE /api/dictionary/:word
export function handleRemoveFromUserDict(word: string): Response {
  removeFromUserDictionary(decodeURIComponent(word))
  return json({ success: true })
}

// GET /api/dictionary/:word
export function handleGetWordFromUserDict(word: string): Response {
  const entry = getWordFromUserDictionary(decodeURIComponent(word))
  if (!entry) {
    return json({ error: 'Слово не найдено в словаре пользователя' }, 404)
  }
  return json(entry)
}

export async function handleGenerateTts(req: Request, bookId: number): Promise<Response> {
  try {
    const book = db.prepare(`SELECT id, language FROM books WHERE id = ?`).get(bookId) as { id: number, language: string } | null
    if (!book)
      return json({ error: 'Книга не найдена' }, 404)

    const { text } = await req.json() as { text?: string }
    if (!text)
      return json({ error: 'Текст не передан' }, 400)

    const audioBase64 = await generateTts(text, book.language || 'en')

    return json({ audioBase64 })
  }
  catch (e: any) {
    console.error('TTS Handler Error:', e)
    return json({ error: e.message }, 500)
  }
}
