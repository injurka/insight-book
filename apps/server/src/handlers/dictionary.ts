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
import { AppError } from '../utils/errors'

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
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

export async function handleGetUserDict(req: Request, userId: number): Promise<Response> {
  return json(await getUserDictionary(userId))
}

export async function handleGetDecks(req: Request, userId: number): Promise<Response> {
  return json(await getUserDecks(userId))
}

export async function handleCreateDeck(req: Request, userId: number): Promise<Response> {
  const body = DeckSchema.parse(await req.json())
  const newDeck = await createDeck(userId, body.name, body.language || 'en')
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
  await upsertToUserDictionary(body, userId)
  return json({ success: true })
}

export async function handleRemoveFromUserDict(req: Request, userId: number): Promise<Response> {
  const word = (req as any).params.word
  await removeFromUserDictionary(decodeURIComponent(word), userId)
  return json({ success: true })
}

export async function handleGetWordFromUserDict(req: Request, userId: number): Promise<Response> {
  const word = (req as any).params.word
  const entry = await getWordFromUserDictionary(decodeURIComponent(word), userId)

  if (!entry) {
    throw new AppError(404, 'Слово не найдено в словаре пользователя')
  }

  return json(entry)
}

export async function handleGetReviewQueue(req: Request, userId: number): Promise<Response> {
  const url = new URL(req.url)
  const lang = url.searchParams.get('lang') || 'all'
  const forceAll = url.searchParams.get('forceAll') === 'true'

  return json(await getReviewQueue(userId, lang, forceAll))
}

export async function handleSrsReview(req: Request, userId: number): Promise<Response> {
  const { wordId, grade } = SrsReviewSchema.parse(await req.json())
  await processSrsReview(wordId, userId, grade)
  return json({ success: true })
}
