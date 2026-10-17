import { Elysia, t } from 'elysia'
import jwt from 'jsonwebtoken'
import { AUTH_MODE, JWT_SECRET } from '../config'
import { ERROR_CODES } from '../constants/error-codes'
import { bookDeckService } from '../services/book-deck/service'
import { dictionaryService } from '../services/dictionary.service'
import { checkPronunciationAudio, generateDeepDiveQuiz, generateWordAutoFill, generateWordExamples } from '../services/llm.service'
import { cachePlugin } from '../utils/cache'
import { AppError, handleElysiaError } from '../utils/errors'
import { extractLlmConfig, normalizeLanguageCode } from '../utils/helpers'

const authPlugin = new Elysia().derive({ as: 'scoped' }, ({ headers }) => {
  if (AUTH_MODE === 'single')
    return { userId: 1 }

  const authHeader = headers.authorization

  if (!authHeader || !authHeader.startsWith('Bearer '))
    throw new AppError(401, ERROR_CODES.AUTH.UNAUTHORIZED, 'Unauthorized')

  const token = authHeader.split(' ')[1]

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: number }

    return { userId: decoded.userId }
  }
  catch {
    throw new AppError(401, ERROR_CODES.AUTH.INVALID_TOKEN, 'Invalid token')
  }
})

function reviewDeckId(value: string | undefined) {
  let deckId: number | 'none' | (number | 'none')[] | undefined

  if (value && value !== 'all') {
    if (value.includes(',')) {
      const parts = value.split(',')
      const parsed = parts
        .map(p => (p === 'none' ? 'none' : Number(p)))
        .filter(p => p === 'none' || !Number.isNaN(p as number)) as (number | 'none')[]

      if (parsed.length > 0)
        deckId = parsed
    }
    else if (value === 'none') {
      deckId = 'none'
    }
    else {
      const num = Number(value)

      if (!Number.isNaN(num))
        deckId = num
    }
  }

  return deckId
}

export const dictionaryController = new Elysia({ prefix: '/api/dictionary' })
  .use(authPlugin)
  .use(cachePlugin)
  .onError(handleElysiaError)
  .post('/book-deck/open', ({ userId, body, query }) =>
    bookDeckService.open(
      body.bookId,
      userId,
      normalizeLanguageCode(query.targetLang || 'ru'),
      body.restart,
    ), {
    query: t.Object({ targetLang: t.Optional(t.String()) }),
    body: t.Object({ bookId: t.Number({ minimum: 1, multipleOf: 1 }), restart: t.Optional(t.Boolean()) }),
  })
  .post('/book-deck/:id/generate', ({
    userId,
    params,
    body,
    query,
    request,
  }) =>
    bookDeckService.generate(
      params.id,
      body.word,
      userId,
      normalizeLanguageCode(query.targetLang || 'ru'),
      extractLlmConfig(request),
      body.regenerate ?? false,
    ), {
    query: t.Object({ targetLang: t.Optional(t.String()) }),
    body: t.Object({ word: t.String({ minLength: 1, maxLength: 100 }), regenerate: t.Optional(t.Boolean()) }),
  })
  .post('/book-deck/:id/save', ({ userId, params, body, query }) =>
    bookDeckService.save(
      params.id,
      userId,
      normalizeLanguageCode(query.targetLang || 'ru'),
      body.name,
      body.words,
      body.updateExisting ?? false,
    ), {
    query: t.Object({ targetLang: t.Optional(t.String()) }),
    body: t.Object({ name: t.String({ minLength: 1, maxLength: 200 }), words: t.Array(t.String(), { minItems: 1, maxItems: 50000 }), updateExisting: t.Optional(t.Boolean()) }),
  })
  .get('/', async ({ userId, query }) => {
    const targetLang = normalizeLanguageCode(query.targetLang || 'ru')

    return await dictionaryService.getUserDictionary(userId, targetLang)
  }, {
    cache: 'shortPrivate',
    query: t.Object({ targetLang: t.Optional(t.String()) }),
  })
  .get('/page', async ({ userId, query }) => {
    const targetLang = normalizeLanguageCode(query.targetLang || 'ru')

    return dictionaryService.getUserDictionaryPage(userId, targetLang, {
      ...query,
      offset: query.offset ?? 0,
      limit: query.limit ?? 50,
    })
  }, {
    cache: 'shortPrivate',
    query: t.Object({
      targetLang: t.Optional(t.String()),
      offset: t.Optional(t.Numeric({ minimum: 0, maximum: 10000000, multipleOf: 1 })),
      limit: t.Optional(t.Numeric({ minimum: 1, maximum: 100, multipleOf: 1 })),
      search: t.Optional(t.String({ maxLength: 500 })),
      language: t.Optional(t.String({ maxLength: 20 })),
      decks: t.Optional(t.String({ maxLength: 2000 })),
      difficulties: t.Optional(t.String({ maxLength: 500 })),
      statuses: t.Optional(t.String({ pattern: '^(all|[0-3])(,(all|[0-3]))*$' })),
    }),
  })
  .post('/', async ({ userId, body, query }) => {
    const targetLang = normalizeLanguageCode(query.targetLang || 'ru')
    const lang = body.language ? normalizeLanguageCode(body.language) : undefined
    await dictionaryService.upsertToUserDictionary({
      ...body,
      language: lang,
    }, userId, targetLang)

    return { success: true }
  }, {
    query: t.Object({ targetLang: t.Optional(t.String()) }),
    body: t.Object({
      word: t.String(),
      transcription: t.Optional(t.Nullable(t.String())),
      translation: t.Optional(t.Nullable(t.String())),
      language: t.String(),
      notes: t.Optional(t.Nullable(t.String())),
      tags: t.Optional(t.Nullable(t.String())),
      difficulty: t.Optional(t.Nullable(t.String())),
      grammarNote: t.Optional(t.Nullable(t.String())),
      vocabularyNote: t.Optional(t.Nullable(t.String())),
      deckIds: t.Optional(t.Array(t.Number())),
      contextSentence: t.Optional(t.String()),
      contextBookId: t.Optional(t.Number()),
    }),
  })
  .post('/bulk/delete', async ({ userId, body }) => {
    await dictionaryService.bulkDeleteDict(userId, body.wordIds)

    return { success: true }
  }, {
    body: t.Object({ wordIds: t.Array(t.Number()) }),
  })
  .post('/bulk/move', async ({ userId, body }) => {
    await dictionaryService.bulkMoveDict(userId!, body.wordIds, body.deckIds)

    return { success: true }
  }, {
    body: t.Object({ wordIds: t.Array(t.Number()), deckIds: t.Optional(t.Array(t.Number())) }),
  })
  .post('/generate-examples', async ({ userId, body, query, request }) => {
    const config = extractLlmConfig(request)
    const targetLang = normalizeLanguageCode(query.targetLang || 'ru')
    const result = await generateWordExamples(
      userId,
      body.word,
      normalizeLanguageCode(body.language),
      targetLang,
      config,
    )

    return result
  }, {
    query: t.Object({ targetLang: t.Optional(t.String()) }),
    body: t.Object({ word: t.String(), language: t.String() }),
  })
  .post('/auto-fill', async ({ userId, body, query, request }) => {
    const config = extractLlmConfig(request)
    const targetLang = normalizeLanguageCode(query.targetLang || 'ru')

    return await generateWordAutoFill(
      userId,
      body.word,
      normalizeLanguageCode(body.language || 'en'),
      targetLang,
      config,
    )
  }, {
    query: t.Object({ targetLang: t.Optional(t.String()) }),
    body: t.Object({ word: t.String(), language: t.Optional(t.String()) }),
  })
  .post('/deep-dive', async ({ userId, body, query, request }) => {
    const config = extractLlmConfig(request)
    const targetLang = normalizeLanguageCode(query.targetLang || 'ru')

    return await generateDeepDiveQuiz(
      userId,
      body.word,
      normalizeLanguageCode(body.language),
      targetLang,
      body.mode as 'collocations' | 'radicals',
      config,
    )
  }, {
    query: t.Object({ targetLang: t.Optional(t.String()) }),
    body: t.Object({ word: t.String(), language: t.String(), mode: t.Union([t.Literal('collocations'), t.Literal('radicals')]) }),
  })
  .get('/prompts', async ({ userId }) => {
    return await dictionaryService.getCustomPrompts(userId)
  }, { cache: 'shortPrivate' })
  .post('/prompts', async ({ userId, body }) => {
    return await dictionaryService.createCustomPrompt(userId, body.name, body.prompt)
  }, {
    body: t.Object({ name: t.String(), prompt: t.String() }),
  })
  .patch('/prompts/:id', async ({ userId, params: { id }, body }) => {
    return await dictionaryService.updateCustomPrompt(Number(id), userId, body)
  }, {
    params: t.Object({ id: t.String() }),
    body: t.Object({ name: t.Optional(t.String()), prompt: t.Optional(t.String()) }),
  })
  .delete('/prompts/:id', async ({ userId, params: { id } }) => {
    await dictionaryService.deleteCustomPrompt(Number(id), userId)

    return { success: true }
  }, {
    params: t.Object({ id: t.String() }),
  })
  .post('/chat', async ({ userId, body, request }) => {
    const config = extractLlmConfig(request)
    const result = await dictionaryService.dictionaryChat(
      userId,
      body.word,
      body.language,
      body.uiLanguage,
      body.customPromptId,
      body.userPromptText,
      config,
    )

    return { response: result }
  }, {
    body: t.Object({
      word: t.String(),
      language: t.String(),
      customPromptId: t.Optional(t.Number()),
      userPromptText: t.Optional(t.String()),
      uiLanguage: t.String(),
    }),
  })
  .get('/decks', async ({ userId, query }) => {
    const targetLang = normalizeLanguageCode(query.targetLang || 'ru')

    return await dictionaryService.getUserDecks(userId, targetLang)
  }, {
    cache: 'shortPrivate',
    query: t.Object({ targetLang: t.Optional(t.String()) }),
  })
  .post('/decks', async ({ userId, body, query }) => {
    const targetLang = normalizeLanguageCode(query.targetLang || 'ru')

    return await dictionaryService.createDeck(
      userId,
      body.name,
      normalizeLanguageCode(body.language || 'en'),
      targetLang,
    )
  }, {
    query: t.Object({ targetLang: t.Optional(t.String()) }),
    body: t.Object({ name: t.String(), language: t.Optional(t.String()) }),
  })
  .patch('/decks/:id', async ({ userId, params: { id }, body }) => {
    await dictionaryService.updateDeck(Number(id), userId, body.name)

    return { success: true }
  }, {
    params: t.Object({ id: t.String() }),
    body: t.Object({ name: t.String(), language: t.Optional(t.String()) }),
  })
  .delete('/decks/:id', async ({ params: { id }, userId, query }) => {
    await dictionaryService.deleteDeck(Number(id), userId, (query.mode as 'keep' | 'delete_all' | 'delete_exclusive') || 'keep')

    return { success: true }
  }, {
    params: t.Object({ id: t.String() }),
    query: t.Object({ mode: t.Optional(t.Union([t.Literal('keep'), t.Literal('delete_all'), t.Literal('delete_exclusive')])) }),
  })
  .get('/catalog', async () => {
    return await dictionaryService.getCatalogDecks()
  }, { cache: 'longPublic' })
  .get('/catalog/:id/words', async ({ params: { id } }) => {
    return await dictionaryService.getCatalogWords(Number(id))
  }, {
    params: t.Object({ id: t.String() }),
    cache: 'longPublic',
  })
  .post('/catalog/:id/clone', async ({ userId, params: { id }, query }) => {
    const targetLang = normalizeLanguageCode(query.targetLang || 'ru')
    const deckId = await dictionaryService.cloneCatalogDeck(userId, Number(id), targetLang)

    return { success: true, deckId }
  }, {
    params: t.Object({ id: t.String() }),
    query: t.Object({ targetLang: t.Optional(t.String()) }),
  })
  .post('/import', async ({ userId, body, query, request }) => {
    const targetLang = normalizeLanguageCode(query.targetLang || 'ru')
    const config = extractLlmConfig(request)
    await dictionaryService.importCsv(
      userId,
      body.rows,
      body.mapping,
      targetLang,
      body.language,
      body.deckId,
      body.newDeckName,
      body.autoFill,
      config,
    )

    return { success: true }
  }, {
    query: t.Object({ targetLang: t.Optional(t.String()) }),
    body: t.Object({
      rows: t.Array(t.Any()),
      mapping: t.Any(),
      deckId: t.Optional(t.Number()),
      newDeckName: t.Optional(t.String()),
      language: t.Optional(t.String()),
      autoFill: t.Optional(t.Boolean()),
    }),
  })
  .get('/review/count', async ({ userId, query }) => {
    return dictionaryService.getReviewCount(
      userId,
      normalizeLanguageCode(query.language || query.lang || 'all'),
      query.targetLang || 'ru',
      reviewDeckId(query.deckId),
      query.difficulty,
    )
  }, {
    cache: 'shortPrivate',
    query: t.Object({
      targetLang: t.Optional(t.String()),
      language: t.Optional(t.String()),
      lang: t.Optional(t.String()),
      deckId: t.Optional(t.String()),
      difficulty: t.Optional(t.String()),
    }),
  })
  .get('/review', async ({ userId, query }) => {
    const normalizedLang = normalizeLanguageCode((query.language || query.lang) as string)
    const targetLang = (query.targetLang as string) || 'ru'

    const deckId = reviewDeckId(query.deckId)

    return await dictionaryService.getReviewQueue(
      userId,
      normalizedLang,
      targetLang,
      (query.mode as 'srs' | 'random' | 'deep_dive' | 'cram') || 'srs',
      deckId,
      query.difficulty as string | undefined,
    )
  }, {
    requireAuth: true,
    cache: 'shortPrivate',
    query: t.Object({
      targetLang: t.Optional(t.String()),
      language: t.Optional(t.String()),
      lang: t.Optional(t.String()),
      mode: t.Optional(t.String()),
      deckId: t.Optional(t.String()),
      difficulty: t.Optional(t.String()),
    }),
  })
  .post('/review', async ({ userId, body }) => {
    await dictionaryService.processSrsReview(body.wordId, userId, body.grade)

    return { success: true }
  }, {
    body: t.Object({ wordId: t.Number(), grade: t.Number() }),
  })
  .post('/pronunciation', async ({ userId, body, query, request }) => {
    const config = extractLlmConfig(request)
    const targetLang = normalizeLanguageCode(query.targetLang || 'ru')

    if (!body.audio || !body.word)
      throw new AppError(400, ERROR_CODES.DICTIONARY.AUDIO_AND_WORD_REQUIRED, 'Audio and word required')

    return await checkPronunciationAudio(
      userId,
      body.word,
      normalizeLanguageCode(body.language),
      targetLang,
      body.audio as File,
      config,
    )
  }, {
    query: t.Object({ targetLang: t.Optional(t.String()) }),
    body: t.Object({ audio: t.Any(), word: t.String(), language: t.String() }),
  })
  .get('/:word', async ({ userId, params: { word }, query }) => {
    const targetLang = normalizeLanguageCode(query.targetLang || 'ru')

    return await dictionaryService.getWordFromUserDictionary(
      decodeURIComponent(word),
      userId,
      targetLang,
      query.language ? normalizeLanguageCode(query.language) : undefined,
    )
  }, {
    cache: 'shortPrivate',
    params: t.Object({ word: t.String() }),
    query: t.Object({ targetLang: t.Optional(t.String()), language: t.Optional(t.String({ minLength: 1 })) }),
  })
  .delete('/:word', async ({ userId, params: { word }, query }) => {
    const targetLang = normalizeLanguageCode(query.targetLang || 'ru')
    await dictionaryService.removeFromUserDictionary(
      decodeURIComponent(word),
      userId,
      targetLang,
      query.language ? normalizeLanguageCode(query.language) : undefined,
    )

    return { success: true }
  }, {
    params: t.Object({ word: t.String() }),
    query: t.Object({ targetLang: t.Optional(t.String()), language: t.Optional(t.String({ minLength: 1 })) }),
  })
