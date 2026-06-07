import { z } from 'zod'
import { CORS_HEADERS } from '../config'
import {
  createDeck,
  deleteDeck,
  getReviewQueue,
  getUserDecks,
  getUserDictionary,
  getWordFromUserDictionary,
  processSrsReview,
  removeFromUserDictionary,
  updateDeck,
  upsertToUserDictionary,
} from '../services/dictionary.service'
import { extractLlmConfig, generateWordAutoFill, generateWordExamples } from '../services/llm.service'
import { AppError } from '../utils/errors'
import { createRateLimiter } from '../utils/rate-limit'

const dictAiLimiter = createRateLimiter(60, 60 * 1000)

function json(data: unknown, status = 200, extraHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json', ...extraHeaders },
  })
}

const UpsertUserDictSchema = z.object({
  word: z.string().min(1, 'Слово обязательно'),
  transcription: z.string().nullable().optional(),
  translation: z.string().nullable().optional(),
  language: z.string().min(1, 'Язык обязателен'),
  notes: z.string().nullable().optional(),
  tags: z.string().nullable().optional(),
  difficulty: z.string().nullable().optional(),
  grammarNote: z.string().nullable().optional(),
  vocabularyNote: z.string().nullable().optional(),
  deckId: z.number().nullable().optional(),
  contextSentence: z.string().optional(),
  contextBookId: z.number().optional(),
})

const SrsReviewSchema = z.object({
  wordId: z.number(),
  grade: z.number().min(0).max(3),
})

const DeckSchema = z.object({
  name: z.string().min(1, 'Название обязательно'),
  language: z.string().optional(),
})

const GenerateExamplesSchema = z.object({
  word: z.string()
    .min(1, 'Слово обязательно')
    .max(100, 'Выделен слишком большой фрагмент текста (макс. 100 символов)'),
  language: z.string().min(1, 'Язык обязателен'),
})

export async function handleGenerateExamples(req: Request, userId: number): Promise<Response> {
  dictAiLimiter(String(userId))
  const config = extractLlmConfig(req)
  const targetLang = req.headers.get('Accept-Language') || 'ru'
  const { word, language } = GenerateExamplesSchema.parse(await req.json())
  const result = await generateWordExamples(word, language, targetLang, config)

  return json(result)
}

export async function handleAutoFillWord(req: Request, userId: number): Promise<Response> {
  dictAiLimiter(String(userId))
  const config = extractLlmConfig(req)
  const targetLang = req.headers.get('Accept-Language') || 'ru'
  const { word, language } = GenerateExamplesSchema.parse(await req.json())
  const result = await generateWordAutoFill(word, language, targetLang, config)

  return json(result)
}

export async function handleGetUserDict(req: Request, userId: number): Promise<Response> {
  const targetLang = req.headers.get('Accept-Language') || 'ru'

  return json(await getUserDictionary(userId, targetLang), 200, { 'Cache-Control': 'private, stale-while-revalidate=60' })
}

export async function handleGetDecks(req: Request, userId: number): Promise<Response> {
  const targetLang = req.headers.get('Accept-Language') || 'ru'

  return json(await getUserDecks(userId, targetLang), 200, { 'Cache-Control': 'private, stale-while-revalidate=60' })
}

export async function handleCreateDeck(req: Request, userId: number): Promise<Response> {
  const body = DeckSchema.parse(await req.json())
  const targetLang = req.headers.get('Accept-Language') || 'ru'
  const newDeck = await createDeck(userId, body.name, body.language || 'en', targetLang)

  return json(newDeck)
}

export async function handleUpdateDeck(req: Request, userId: number): Promise<Response> {
  const id = Number((req as any).params.id)
  const body = DeckSchema.parse(await req.json())
  await updateDeck(id, userId, body.name)

  return json({ success: true })
}

export async function handleDeleteDeck(req: Request, userId: number): Promise<Response> {
  const id = Number((req as any).params.id)
  await deleteDeck(id, userId)

  return json({ success: true })
}

export async function handleUpsertToUserDict(req: Request, userId: number): Promise<Response> {
  const body = UpsertUserDictSchema.parse(await req.json())
  const targetLang = req.headers.get('Accept-Language') || 'ru'
  await upsertToUserDictionary(body, userId, targetLang)

  return json({ success: true })
}

export async function handleRemoveFromUserDict(req: Request, userId: number): Promise<Response> {
  const word = (req as any).params.word
  const targetLang = req.headers.get('Accept-Language') || 'ru'
  await removeFromUserDictionary(decodeURIComponent(word), userId, targetLang)

  return json({ success: true })
}

export async function handleGetWordFromUserDict(req: Request, userId: number): Promise<Response> {
  const word = (req as any).params.word
  const targetLang = req.headers.get('Accept-Language') || 'ru'
  const entry = await getWordFromUserDictionary(decodeURIComponent(word), userId, targetLang)

  if (!entry) {
    throw new AppError(404, 'Слово не найдено в словаре пользователя')
  }

  return json(entry, 200, { 'Cache-Control': 'private, stale-while-revalidate=60' })
}

export async function handleGetReviewQueue(req: Request, userId: number): Promise<Response> {
  const url = new URL(req.url)
  const lang = url.searchParams.get('lang') || 'all'
  const mode = url.searchParams.get('mode') as 'srs' | 'random' || 'srs'
  const deckIdStr = url.searchParams.get('deckId')
  const difficulty = url.searchParams.get('difficulty')
  const targetLang = req.headers.get('Accept-Language') || 'ru'

  let deckId: number | 'none' | undefined
  if (deckIdStr === 'none')
    deckId = 'none'
  else if (deckIdStr && deckIdStr !== 'all')
    deckId = Number(deckIdStr)

  return json(await getReviewQueue(userId, lang, targetLang, mode, deckId, difficulty || undefined))
}

export async function handleSrsReview(req: Request, userId: number): Promise<Response> {
  const { wordId, grade } = SrsReviewSchema.parse(await req.json())
  await processSrsReview(wordId, userId, grade)
  return json({ success: true })
}

const BulkActionSchema = z.object({
  wordIds: z.array(z.number()),
  deckId: z.number().nullable().optional(),
})

export async function handleBulkDeleteDict(req: Request, userId: number): Promise<Response> {
  const { wordIds } = BulkActionSchema.parse(await req.json())
  const { db } = await import('../db')
  const { userDictionary } = await import('../db/schema')
  const { inArray, and, eq } = await import('drizzle-orm')

  await db.delete(userDictionary).where(and(
    inArray(userDictionary.id, wordIds),
    eq(userDictionary.userId, userId),
  ))
  return json({ success: true })
}

export async function handleBulkMoveDict(req: Request, userId: number): Promise<Response> {
  const { wordIds, deckId } = BulkActionSchema.parse(await req.json())
  const { db } = await import('../db')
  const { userDictionary } = await import('../db/schema')
  const { inArray, and, eq } = await import('drizzle-orm')

  await db.update(userDictionary).set({ deckId: deckId || null }).where(and(
    inArray(userDictionary.id, wordIds),
    eq(userDictionary.userId, userId),
  ))
  return json({ success: true })
}
