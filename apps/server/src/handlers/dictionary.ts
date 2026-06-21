import { and, eq, inArray, sql } from 'drizzle-orm'
import { db } from '~/db'
import { catalogDb } from '~/db/catalog'
import { BulkActionSchema, DeckSchema, DeepDiveRequestSchema, GenerateExamplesSchema, SrsReviewSchema, UpsertUserDictSchema } from '~/types/schemas'
import { extractLlmConfig, json, normalizeLanguageCode } from '~/utils/helpers'
import { officialDecks, officialDeckWords } from '../db/catalog-schema'
import { userDictionary } from '../db/schema'
import { trackActivity } from '../services/activity.service'
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
import { checkPronunciationAudio, generateDeepDiveQuiz, generateWordAutoFill, generateWordExamples } from '../services/llm.service'
import { AppError } from '../utils/errors'
import { createRateLimiter } from '../utils/rate-limit'

const dictAiLimiter = createRateLimiter(60, 60 * 1000)

export async function handleGenerateExamples(req: Request, userId: number): Promise<Response> {
  dictAiLimiter(String(userId))
  const config = extractLlmConfig(req)
  const targetLang = normalizeLanguageCode(req.headers.get('Accept-Language') || 'ru')
  const { word, language } = GenerateExamplesSchema.parse(await req.json())
  const result = await generateWordExamples(userId, word, normalizeLanguageCode(language), targetLang, config)

  return json(result)
}

export async function handleAutoFillWord(req: Request, userId: number): Promise<Response> {
  dictAiLimiter(String(userId))
  const config = extractLlmConfig(req)
  const targetLang = normalizeLanguageCode(req.headers.get('Accept-Language') || 'ru')
  const { word, language } = GenerateExamplesSchema.parse(await req.json())
  const result = await generateWordAutoFill(userId, word, normalizeLanguageCode(language), targetLang, config)

  return json(result)
}

export async function handleGenerateDeepDive(req: Request, userId: number): Promise<Response> {
  dictAiLimiter(String(userId))
  const config = extractLlmConfig(req)
  const targetLang = normalizeLanguageCode(req.headers.get('Accept-Language') || 'ru')
  const { word, language, mode } = DeepDiveRequestSchema.parse(await req.json())

  const result = await generateDeepDiveQuiz(userId, word, normalizeLanguageCode(language), targetLang, mode, config)

  return json(result)
}

export async function handleCheckPronunciation(req: Request, userId: number): Promise<Response> {
  dictAiLimiter(String(userId))

  const formData = await req.formData()
  const audioFile = formData.get('audio') as File | null
  const word = formData.get('word') as string
  const language = formData.get('language') as string
  const targetLang = normalizeLanguageCode(req.headers.get('Accept-Language') || 'ru')

  if (!audioFile || !word) {
    throw new AppError(400, 'Audio file and word are required')
  }

  const config = extractLlmConfig(req)
  const result = await checkPronunciationAudio(userId, word, normalizeLanguageCode(language), targetLang, audioFile, config)

  return json(result)
}

export async function handleGetUserDict(req: Request, userId: number): Promise<Response> {
  const targetLang = normalizeLanguageCode(req.headers.get('Accept-Language') || 'ru')

  return json(await getUserDictionary(userId, targetLang), 200, { 'Cache-Control': 'private, stale-while-revalidate=60' })
}

export async function handleGetDecks(req: Request, userId: number): Promise<Response> {
  const targetLang = normalizeLanguageCode(req.headers.get('Accept-Language') || 'ru')

  return json(await getUserDecks(userId, targetLang), 200, { 'Cache-Control': 'private, stale-while-revalidate=60' })
}

export async function handleCreateDeck(req: Request, userId: number): Promise<Response> {
  const body = DeckSchema.parse(await req.json())
  const targetLang = normalizeLanguageCode(req.headers.get('Accept-Language') || 'ru')
  const newDeck = await createDeck(userId, body.name, normalizeLanguageCode(body.language || 'en'), targetLang)

  return json(newDeck)
}

export async function handleUpdateDeck(req: Request, userId: number): Promise<Response> {
  const id = Number(req.params.id)
  const body = DeckSchema.parse(await req.json())
  await updateDeck(id, userId, body.name)

  return json({ success: true })
}

export async function handleDeleteDeck(req: Request, userId: number): Promise<Response> {
  const id = Number(req.params.id)
  await deleteDeck(id, userId)

  return json({ success: true })
}

export async function handleUpsertToUserDict(req: Request, userId: number): Promise<Response> {
  const body = UpsertUserDictSchema.parse(await req.json())
  const targetLang = normalizeLanguageCode(req.headers.get('Accept-Language') || 'ru')
  if (body.language) {
    body.language = normalizeLanguageCode(body.language)
  }
  await upsertToUserDictionary(body, userId, targetLang)

  return json({ success: true })
}

export async function handleRemoveFromUserDict(req: Request, userId: number): Promise<Response> {
  const word = req.params.word
  const targetLang = normalizeLanguageCode(req.headers.get('Accept-Language') || 'ru')
  await removeFromUserDictionary(decodeURIComponent(word), userId, targetLang)

  return json({ success: true })
}

export async function handleGetWordFromUserDict(req: Request, userId: number): Promise<Response> {
  const word = req.params.word
  const targetLang = normalizeLanguageCode(req.headers.get('Accept-Language') || 'ru')
  const entry = await getWordFromUserDictionary(decodeURIComponent(word), userId, targetLang)

  if (!entry) {
    throw new AppError(404, 'Слово не найдено в словаре пользователя')
  }

  return json(entry, 200, { 'Cache-Control': 'private, stale-while-revalidate=60' })
}

export async function handleGetReviewQueue(req: Request, userId: number): Promise<Response> {
  const url = new URL(req.url)
  const lang = url.searchParams.get('lang') || 'all'
  const mode = url.searchParams.get('mode') as 'srs' | 'random' | 'deep_dive' || 'srs'
  const deckIdStr = url.searchParams.get('deckId')
  const difficulty = url.searchParams.get('difficulty')
  const targetLang = normalizeLanguageCode(req.headers.get('Accept-Language') || 'ru')

  let deckId: number | 'none' | undefined
  if (deckIdStr === 'none')
    deckId = 'none'
  else if (deckIdStr && deckIdStr !== 'all')
    deckId = Number(deckIdStr)

  const normalizedLang = lang === 'all' ? 'all' : normalizeLanguageCode(lang)

  return json(await getReviewQueue(userId, normalizedLang, targetLang, mode, deckId, difficulty || undefined))
}

export async function handleSrsReview(req: Request, userId: number): Promise<Response> {
  const { wordId, grade } = SrsReviewSchema.parse(await req.json())
  await processSrsReview(wordId, userId, grade)
  return json({ success: true })
}

export async function handleBulkDeleteDict(req: Request, userId: number): Promise<Response> {
  const { wordIds } = BulkActionSchema.parse(await req.json())

  await db.delete(userDictionary).where(and(
    inArray(userDictionary.id, wordIds),
    eq(userDictionary.userId, userId),
  ))
  return json({ success: true })
}

export async function handleBulkMoveDict(req: Request, userId: number): Promise<Response> {
  const { wordIds, deckId } = BulkActionSchema.parse(await req.json())

  await db.update(userDictionary).set({ deckId: deckId || null }).where(and(
    inArray(userDictionary.id, wordIds),
    eq(userDictionary.userId, userId),
  ))
  return json({ success: true })
}

export async function handleGetCatalogDecks(_req: Request, _userId: number): Promise<Response> {
  const decks = await catalogDb.select().from(officialDecks)
  return json(decks)
}

export async function handleGetCatalogWords(req: Request, _userId: number): Promise<Response> {
  const deckId = Number(req.params.id)
  const words = await catalogDb.select().from(officialDeckWords).where(eq(officialDeckWords.deckId, deckId))
  return json(words)
}

export async function handleCloneCatalogDeck(req: Request, userId: number): Promise<Response> {
  const deckId = Number(req.params.id)

  const deckToClone = await catalogDb.select().from(officialDecks).where(eq(officialDecks.id, deckId)).get()
  if (!deckToClone)
    throw new AppError(404, 'Deck not found')

  const wordsToClone = await catalogDb.select().from(officialDeckWords).where(eq(officialDeckWords.deckId, deckId))

  // Create user deck
  const targetLang = normalizeLanguageCode(req.headers.get('Accept-Language') || 'ru')
  const newDeck = await createDeck(userId, deckToClone.title, deckToClone.language, targetLang)

  if (wordsToClone.length > 0) {
    const userWords = wordsToClone.map(w => ({
      userId,
      deckId: newDeck.id,
      word: w.word,
      transcription: w.transcription,
      translation: w.translation,
      difficulty: w.difficulty,
      tags: w.tags,
      language: deckToClone.language,
      targetLanguage: targetLang,
      grammarNote: w.grammarNote,
      vocabularyNote: w.vocabularyNote,
      updatedAt: new Date().toISOString(),
    }))

    await db.insert(userDictionary).values(userWords).onConflictDoUpdate({
      target: [userDictionary.userId, userDictionary.word, userDictionary.targetLanguage],
      set: {
        transcription: sql`excluded.transcription`,
        translation: sql`excluded.translation`,
        grammarNote: sql`excluded.grammarNote`,
        vocabularyNote: sql`excluded.vocabularyNote`,
        deckId: newDeck.id,
        updatedAt: new Date().toISOString(),
      },
    })

    await trackActivity(userId, 'added', userWords.length)
  }

  return json({ success: true, deckId: newDeck.id })
}

async function processAutofillInBackground(
  userId: number,
  targetDeckId: number | undefined,
  targetLang: string,
  wordsToFill: string[],
  language: string | undefined,
  config: any,
) {
  for (const word of wordsToFill) {
    try {
      const result = await generateWordAutoFill(userId, word, normalizeLanguageCode(language || 'en'), targetLang, config)
      if (result) {
        await upsertToUserDictionary({
          word,
          translation: result.translation || '',
          transcription: result.transcription || '',
          language: normalizeLanguageCode(language || 'en'),
          deckId: targetDeckId,
        }, userId, targetLang)
      }
    }
    catch (e) {
      console.error('Failed to background autofill word:', word, e)
    }
  }
}

export async function handleImportCsv(req: Request, userId: number): Promise<Response> {
  const body = await req.json()
  // Assuming body has { rows: Array<Record<string, string>>, mapping: { word: string, translation?: string, transcription?: string, tags?: string }, deckId?: number, newDeckName?: string, language?: string, autoFill?: boolean }
  const { rows, mapping, deckId, newDeckName, language, autoFill } = body
  const targetLang = normalizeLanguageCode(req.headers.get('Accept-Language') || 'ru')

  let targetDeckId = deckId
  if (newDeckName) {
    const newDeck = await createDeck(userId, newDeckName, normalizeLanguageCode(language || 'en'), targetLang)
    targetDeckId = newDeck.id
  }

  const wordsToFill: string[] = []
  for (const row of rows) {
    const word = row[mapping.word]
    if (!word)
      continue

    const translation = mapping.translation ? row[mapping.translation] : ''
    const transcription = mapping.transcription ? row[mapping.transcription] : ''
    const tags = mapping.tags ? row[mapping.tags] : ''

    await upsertToUserDictionary({
      word,
      translation,
      transcription,
      tags,
      deckId: targetDeckId,
      language: normalizeLanguageCode(language || 'en'),
    }, userId, targetLang)

    if (autoFill && !translation) {
      wordsToFill.push(word)
    }
  }

  if (wordsToFill.length > 0) {
    const config = extractLlmConfig(req)
    processAutofillInBackground(userId, targetDeckId, targetLang, wordsToFill, language, config).catch((e) => {
      console.error('Background autofill loop crashed:', e)
    })
  }

  return json({ success: true })
}
