import type { PagePayload, UserDictItem } from '../types'
import { CORS_HEADERS } from '../config'
import { db } from '../db'
import { getUserDictionary, getWordFromUserDictionary, lookupSingleWord, lookupWords, removeFromUserDictionary, upsertToUserDictionary } from '../services/dictionary.service'
import { processEpub } from '../services/epub.service'
import { analyzeSentence } from '../services/gemini.service'
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
  const book = db.prepare(`SELECT totalPages FROM books WHERE id = ?`).get(bookId) as { totalPages: number } | null
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

  const sentences = await tokenizePage(pageRow.content)

  const allWords = new Set<string>()
  for (const s of sentences) {
    for (const t of s.tokens) {
      if (/[\u4E00-\u9FFF]/.test(t.word))
        allWords.add(t.word)
    }
  }

  const pageDictionary = lookupWords([...allWords])

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
export function handleLookupWord(word: string): Response {
  const entry = lookupSingleWord(decodeURIComponent(word))
  if (!entry)
    return json({ error: 'Слово не найдено' }, 404)
  return json(entry)
}

// POST /api/books/:id/analyze
export async function handleAnalyzeSentence(req: Request): Promise<Response> {
  try {
    const body = await req.json() as { sentence: string }
    if (!body.sentence)
      return json({ error: 'sentence обязателен' }, 400)
    const analysis = await analyzeSentence(body.sentence)
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
    return json({ error: 'Слово не найдено в словаре' }, 404)
  }
  return json(entry)
}
