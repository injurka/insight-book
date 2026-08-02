import { readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Database } from 'bun:sqlite'
import { eq, inArray, like } from 'drizzle-orm'
import { Elysia, t } from 'elysia'
import jwt from 'jsonwebtoken'
import { AUTH_MODE, JWT_SECRET } from '../config'
import { db } from '../db'
import { catalogDb } from '../db/catalog'
import { officialDecks, officialDeckWords } from '../db/catalog-schema'
import { dictionaryService } from '../services/dictionary.service'
import { checkPronunciationAudio, generateDeepDiveQuiz, generateWordExamples } from '../services/llm.service'
import { AppError } from '../utils/errors'
import { extractLlmConfig, normalizeLanguageCode } from '../utils/helpers'
import { logger } from '../utils/logger'

const authPlugin = new Elysia().derive({ as: 'global' }, ({ headers }) => {
  if (AUTH_MODE === 'single')
    return { userId: 1 }
  const authHeader = headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer '))
    throw new AppError(401, 'Необходима авторизация')
  const token = authHeader.split(' ')[1]
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: number }
    return { userId: decoded.userId }
  }
  catch {
    throw new AppError(401, 'Недействительный токен')
  }
})

export const dictionaryController = new Elysia({ prefix: '/api/dictionary' })
  .use(authPlugin)
  .onError(({ error, set }) => {
    if (error instanceof AppError) {
      set.status = error.statusCode
      return { error: error.message }
    }
    logger.error(error)
    set.status = 500
    return { error: 'Internal Server Error' }
  })
  .get('/llm-cache', async ({ query, set }) => {
    const lang = normalizeLanguageCode(query.lang || 'en')
    const targetLang = normalizeLanguageCode(query.targetLang || 'ru')

    // LLM-кэш предложений для выбранного языка
    const rows = await db.query.llmCache.findMany({
      where: (table, { eq: eqCol, and }) => and(eqCol(table.language, lang), eqCol(table.targetLanguage, targetLang)),
    })

    // Публичный словарь (официальные колоды каталога) для выбранного языка
    let langDecks = await catalogDb.select().from(officialDecks).where(eq(officialDecks.language, lang))
    // Fallback для региональных кодов вида 'en-US' / 'zh-CN'
    if (langDecks.length === 0) {
      langDecks = await catalogDb.select().from(officialDecks).where(like(officialDecks.language, `${lang}-%`))
    }
    const deckIds = langDecks.map(d => d.id)
    const catalogWords = deckIds.length > 0
      ? await catalogDb.select().from(officialDeckWords).where(inArray(officialDeckWords.deckId, deckIds))
      : []

    // Дедупликация: одно и то же слово может встречаться в нескольких колодах —
    // объединяем их deckIds в одну запись (OR IGNORE без UNIQUE тут бы не помог)
    const dedupedWords = new Map<string, {
      id: number
      word: string
      transcription: string | null
      translation: string | null
      tags: string | null
      difficulty: string | null
      grammarNote: string | null
      vocabularyNote: string | null
      deckIds: Set<number>
    }>()
    for (const w of catalogWords) {
      const key = w.word.trim().toLowerCase()
      const existing = dedupedWords.get(key)
      if (existing) {
        if (w.deckId != null)
          existing.deckIds.add(w.deckId)
        // Дополняем пустые поля данными из другой колоды
        existing.transcription ??= w.transcription ?? null
        existing.translation ??= w.translation ?? null
        existing.tags ??= w.tags ?? null
        existing.difficulty ??= w.difficulty ?? null
        existing.grammarNote ??= w.grammarNote ?? null
        existing.vocabularyNote ??= w.vocabularyNote ?? null
      }
      else {
        dedupedWords.set(key, {
          id: w.id,
          word: w.word,
          transcription: w.transcription ?? null,
          translation: w.translation ?? null,
          tags: w.tags ?? null,
          difficulty: w.difficulty ?? null,
          grammarNote: w.grammarNote ?? null,
          vocabularyNote: w.vocabularyNote ?? null,
          deckIds: new Set(w.deckId != null ? [w.deckId] : []),
        })
      }
    }

    // 404 только если нет ни LLM-кэша, ни словаря для этого языка
    if (rows.length === 0 && dedupedWords.size === 0) {
      throw new AppError(404, 'Кэш для данного языка не найден')
    }

    const tempPath = join(tmpdir(), `llm-cache-${lang}-${Date.now()}-${Math.random().toString(36).substring(2)}.sqlite`)
    const tempDb = new Database(tempPath)

    try {
      // bun:sqlite по умолчанию работает в WAL — переключаемся в DELETE,
      // чтобы все данные гарантированно оказались в основном файле,
      // который забирает клиент (без соседнего -wal файла).
      tempDb.exec('PRAGMA journal_mode = DELETE')

      // Порядок колонок (после id) должен совпадать с клиентским merge
      // (sqlite.worker.ts -> DICT_COLUMNS). id — стабильный id слова каталога,
      // на клиенте он мержится как отрицательный (см. mergeRemoteIntoMain).
      tempDb.exec(`CREATE TABLE dictionary (
        id INTEGER PRIMARY KEY,
        word TEXT, transcription TEXT, translation TEXT, language TEXT, target_language TEXT, notes TEXT, tags TEXT, difficulty TEXT,
        grammar_note TEXT, vocabulary_note TEXT, deck_ids_json TEXT, state INTEGER, due TEXT, stability REAL, difficulty_fsrs REAL,
        scheduled_days INTEGER, reps INTEGER, lapses INTEGER, last_review TEXT, learning_steps INTEGER, created_at TEXT, updated_at TEXT, raw_json TEXT
      )`)

      tempDb.exec('CREATE TABLE analyses (text_key TEXT UNIQUE, language TEXT, analysis_json TEXT)')

      tempDb.exec('BEGIN TRANSACTION')
      try {
        if (dedupedWords.size > 0) {
          const now = new Date().toISOString()
          const insertWord = tempDb.prepare(`
            INSERT OR IGNORE INTO dictionary (
              id, word, transcription, translation, language, target_language, notes, tags, difficulty,
              grammar_note, vocabulary_note, deck_ids_json, state, due, stability, difficulty_fsrs,
              scheduled_days, reps, lapses, last_review, learning_steps, created_at, updated_at, raw_json
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `)

          for (const w of dedupedWords.values()) {
            const wordDeckIds = [...w.deckIds]
            const deckIdsJson = JSON.stringify(wordDeckIds)
            const rawJson = JSON.stringify({
              id: w.id,
              word: w.word,
              transcription: w.transcription,
              translation: w.translation,
              language: lang,
              targetLanguage: targetLang,
              notes: null,
              tags: w.tags,
              difficulty: w.difficulty,
              grammarNote: w.grammarNote,
              vocabularyNote: w.vocabularyNote,
              deckIds: wordDeckIds,
              state: 0,
              // due = NULL намеренно: каталожные слова НЕ должны сразу попадать
              // в очередь повторения клиента (getReviewQueue: due <= now)
              due: null,
              createdAt: now,
              updatedAt: now,
              source: 'catalog',
            })

            insertWord.run(
              w.id,
              w.word,
              w.transcription,
              w.translation,
              lang,
              targetLang,
              null,
              w.tags,
              w.difficulty,
              w.grammarNote,
              w.vocabularyNote,
              deckIdsJson,
              0,
              null, // due = NULL (см. выше)
              0,
              0,
              0,
              0,
              0,
              null,
              0,
              now,
              now,
              rawJson,
            )
          }
        }

        if (rows.length > 0) {
          const insert = tempDb.prepare('INSERT OR IGNORE INTO analyses (text_key, language, analysis_json) VALUES (?, ?, ?)')
          for (const row of rows) {
            // Формат ключа ДОЛЖЕН совпадать с клиентским:
            // sqlite.worker.ts -> buildAnalysisKey(): `${lang}_${sentence.trim().toLowerCase()}`
            const textKey = `${lang}_${(row.sentence || '').trim().toLowerCase()}`
            insert.run(textKey, row.language, row.analysis)
          }
        }

        tempDb.exec('COMMIT')
      }
      catch (e) {
        tempDb.exec('ROLLBACK')
        throw e
      }

      // Страховочный checkpoint на случай, если journal_mode всё же остался WAL
      try {
        tempDb.exec('PRAGMA wal_checkpoint(TRUNCATE)')
      }
      catch { }

      tempDb.close()

      const fileBuffer = await readFile(tempPath)

      set.headers['Content-Type'] = 'application/vnd.sqlite3'
      set.headers['Content-Disposition'] = `attachment; filename="insight-offline-${lang}.sqlite"`
      set.headers['Content-Length'] = String(fileBuffer.byteLength)
      set.headers['Cache-Control'] = 'no-store'
      return new Response(fileBuffer)
    }
    finally {
      try {
        tempDb.close()
      }
      catch { }
      await rm(tempPath, { force: true })
      await rm(`${tempPath}-wal`, { force: true })
      await rm(`${tempPath}-shm`, { force: true })
    }
  }, {
    query: t.Object({ lang: t.Optional(t.String()), targetLang: t.Optional(t.String()) }),
  })
  .get('/', async ({ userId, query }) => {
    const targetLang = normalizeLanguageCode(query.targetLang || 'ru')
    return await dictionaryService.getUserDictionary(userId, targetLang)
  }, {
    query: t.Object({ targetLang: t.Optional(t.String()) }),
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
  .post('/bulk/move', async ({ body }) => {
    await dictionaryService.bulkMoveDict(body.wordIds, body.deckIds)
    return { success: true }
  }, {
    body: t.Object({ wordIds: t.Array(t.Number()), deckIds: t.Optional(t.Array(t.Number())) }),
  })
  .post('/generate-examples', async ({ userId, body, query, request }) => {
    const config = extractLlmConfig(request)
    const targetLang = normalizeLanguageCode(query.targetLang || 'ru')
    const result = await generateWordExamples(userId, body.word, normalizeLanguageCode(body.language), targetLang, config)
    return result
  }, {
    query: t.Object({ targetLang: t.Optional(t.String()) }),
    body: t.Object({ word: t.String(), language: t.String() }),
  })
  .post('/auto-fill', async () => {
    return { success: true }
  })
  .post('/deep-dive', async ({ userId, body, query, request }) => {
    const config = extractLlmConfig(request)
    const targetLang = normalizeLanguageCode(query.targetLang || 'ru')
    return await generateDeepDiveQuiz(userId, body.word, normalizeLanguageCode(body.language), targetLang, body.mode as 'collocations' | 'radicals', config)
  }, {
    query: t.Object({ targetLang: t.Optional(t.String()) }),
    body: t.Object({ word: t.String(), language: t.String(), mode: t.Union([t.Literal('collocations'), t.Literal('radicals')]) }),
  })
  .get('/prompts', async ({ userId }) => {
    return await dictionaryService.getCustomPrompts(userId)
  })
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
    const result = await dictionaryService.dictionaryChat(userId, body.word, body.language, body.uiLanguage, body.customPromptId, body.userPromptText, config)
    return { response: result }
  }, {
    body: t.Object({ word: t.String(), language: t.String(), customPromptId: t.Optional(t.Number()), userPromptText: t.Optional(t.String()), uiLanguage: t.String() }),
  })
  .get('/decks', async ({ userId, query }) => {
    const targetLang = normalizeLanguageCode(query.targetLang || 'ru')
    return await dictionaryService.getUserDecks(userId, targetLang)
  }, {
    query: t.Object({ targetLang: t.Optional(t.String()) }),
  })
  .post('/decks', async ({ userId, body, query }) => {
    const targetLang = normalizeLanguageCode(query.targetLang || 'ru')
    return await dictionaryService.createDeck(userId, body.name, normalizeLanguageCode(body.language || 'en'), targetLang)
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
    await dictionaryService.deleteDeck(Number(id), userId, (query.mode as "keep" | "delete_all" | "delete_exclusive") || 'keep')
    return { success: true }
  }, {
    params: t.Object({ id: t.String() }),
    query: t.Object({ mode: t.Optional(t.Union([t.Literal('keep'), t.Literal('delete_all'), t.Literal('delete_exclusive')])) }),
  })
  .get('/catalog', async () => {
    return await dictionaryService.getCatalogDecks()
  })
  .get('/catalog/:id/words', async ({ params: { id } }) => {
    return await dictionaryService.getCatalogWords(Number(id))
  }, {
    params: t.Object({ id: t.String() }),
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
    await dictionaryService.importCsv(userId, body.rows, body.mapping, targetLang, body.language, body.deckId, body.newDeckName, body.autoFill, config)
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
  .get('/review', async ({ userId, query }) => {
    const normalizedLang = normalizeLanguageCode((query.language || query.lang) as string)
    const targetLang = (query.targetLang as string) || 'ru'
    const deckId = query.deckId ? Number(query.deckId) : undefined
    return await dictionaryService.getReviewQueue(userId, normalizedLang, targetLang, (query.mode as 'srs' | 'random' | 'deep_dive' | 'cram') || 'srs', deckId, query.difficulty as string | undefined)
  }, {
    requireAuth: true,
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
      throw new AppError(400, 'Audio and word required')
    return await checkPronunciationAudio(userId, body.word, normalizeLanguageCode(body.language), targetLang, body.audio as File, config)
  }, {
    query: t.Object({ targetLang: t.Optional(t.String()) }),
    body: t.Object({ audio: t.Any(), word: t.String(), language: t.String() }),
  })
  .get('/:word', async ({ userId, params: { word }, query }) => {
    const targetLang = normalizeLanguageCode(query.targetLang || 'ru')
    return await dictionaryService.getWordFromUserDictionary(decodeURIComponent(word), userId, targetLang)
  }, {
    params: t.Object({ word: t.String() }),
    query: t.Object({ targetLang: t.Optional(t.String()) }),
  })
  .delete('/:word', async ({ userId, params: { word }, query }) => {
    const targetLang = normalizeLanguageCode(query.targetLang || 'ru')
    await dictionaryService.removeFromUserDictionary(decodeURIComponent(word), userId, targetLang)
    return { success: true }
  }, {
    params: t.Object({ word: t.String() }),
    query: t.Object({ targetLang: t.Optional(t.String()) }),
  })
