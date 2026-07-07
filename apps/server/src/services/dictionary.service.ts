import type { PageDictEntry, UserDictItem } from '../types'
import { and, desc, eq, exists, inArray, notInArray, lte, notExists, sql } from 'drizzle-orm'
import { sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { createEmptyCard, FSRS, Rating } from 'ts-fsrs'
import { db, getDictConnection } from '../db'
import * as schema from '../db/schema'
import { AppError } from '../utils/errors'
import { trackActivity } from './activity.service'

export async function lookupWords(words: string[], language: string, targetLang: string, userId: number): Promise<Record<string, PageDictEntry>> {
  if (!words.length)
    return {}

  const dict: Record<string, PageDictEntry> = {}
  const chunkSize = 500

  for (let i = 0; i < words.length; i += chunkSize) {
    const chunk = words.slice(i, i + chunkSize)

    const userRows = await db.query.userDictionary.findMany({
      where: and(
        inArray(schema.userDictionary.word, chunk),
        eq(schema.userDictionary.userId, userId),
        eq(schema.userDictionary.targetLanguage, targetLang),
      ),
      columns: { word: true, transcription: true, translation: true },
    })

    for (const row of userRows) {
      if (!row.word)
        continue
      const entry = { transcription: row.transcription || '', translation: row.translation || '', isUserDict: true }
      dict[row.word] = entry
      dict[row.word.toLowerCase()] = entry
    }
  }

  const conn = getDictConnection(language, targetLang)
  if (conn) {
    const schemaObj: any = {}
    schemaObj[conn.wordCol] = text(conn.wordCol).notNull()
    schemaObj[conn.translationCol] = text(conn.translationCol)

    if (conn.hasTranscription) {
      schemaObj[conn.transcriptionCol] = text(conn.transcriptionCol)
    }

    const dictTable = sqliteTable(conn.tableName, schemaObj)

    for (let i = 0; i < words.length; i += chunkSize) {
      const chunk = words.slice(i, i + chunkSize)
      const missingWords = chunk.filter(w => !dict[w] && !dict[w.toLowerCase()])
      if (!missingWords.length)
        continue

      try {
        const selection: any = {
          word: dictTable[conn.wordCol],
          translation: dictTable[conn.translationCol],
        }
        if (conn.hasTranscription) {
          selection.transcription = dictTable[conn.transcriptionCol]
        }

        const searchWords = Array.from(new Set(missingWords.flatMap(w => [w, w.toLowerCase()])))

        const rows = await conn.dDb
          .select(selection)
          .from(dictTable)
          .where(inArray(dictTable[conn.wordCol], searchWords))

        for (const row of rows) {
          if (!row.word)
            continue
          const entry = {
            transcription: (conn.hasTranscription ? row.transcription : '') || '',
            translation: row.translation || '',
            isUserDict: false,
          }
          dict[row.word as string] = entry
          dict[(row.word as string).toLowerCase()] = entry
        }
      }
      catch (e) {
        console.error(`[Dictionary Error] Failed to query ${conn.tableName}:`, e)
      }
    }
  }
  return dict
}

export async function lookupSingleWord(word: string, language: string, targetLang: string, userId: number): Promise<PageDictEntry | null> {
  const userWord = await db.query.userDictionary.findFirst({
    where: and(
      eq(schema.userDictionary.word, word),
      eq(schema.userDictionary.userId, userId),
      eq(schema.userDictionary.targetLanguage, targetLang),
    ),
  })
  if (userWord) {
    return { transcription: userWord.transcription || '', translation: userWord.translation || '', isUserDict: true }
  }

  const conn = getDictConnection(language, targetLang)
  if (!conn)
    return null

  const schemaObj: any = {}
  schemaObj[conn.wordCol] = text(conn.wordCol).notNull()
  schemaObj[conn.translationCol] = text(conn.translationCol)

  if (conn.hasTranscription) {
    schemaObj[conn.transcriptionCol] = text(conn.transcriptionCol)
  }

  const dictTable = sqliteTable(conn.tableName, schemaObj)

  try {
    const selection: any = {
      word: dictTable[conn.wordCol],
      translation: dictTable[conn.translationCol],
    }
    if (conn.hasTranscription) {
      selection.transcription = dictTable[conn.transcriptionCol]
    }

    const searchWords = Array.from(new Set([word, word.toLowerCase()]))

    const rows = await conn.dDb
      .select(selection)
      .from(dictTable)
      .where(inArray(dictTable[conn.wordCol], searchWords))
      .limit(1)

    if (rows.length > 0) {
      return {
        transcription: (conn.hasTranscription ? rows[0].transcription : '') || '',
        translation: rows[0].translation || '',
        isUserDict: false,
      }
    }
  }
  catch (e) {
    console.error(`[Dictionary Error] Failed to lookup single word in ${conn.tableName}:`, e)
  }

  return null
}

export async function getUserDecks(userId: number, targetLang: string) {
  return await db.query.dictDecks.findMany({
    where: and(eq(schema.dictDecks.userId, userId), eq(schema.dictDecks.targetLanguage, targetLang)),
  })
}

export async function createDeck(userId: number, name: string, language: string, targetLang: string) {
  const [newDeck] = await db.insert(schema.dictDecks).values({
    userId,
    name,
    language,
    targetLanguage: targetLang,
  }).returning()

  return newDeck
}

export async function updateDeck(deckId: number, userId: number, name: string) {
  const res = await db.update(schema.dictDecks)
    .set({ name })
    .where(and(eq(schema.dictDecks.id, deckId), eq(schema.dictDecks.userId, userId)))
    .returning({ id: schema.dictDecks.id })

  if (res.length === 0)
    throw new AppError(404, 'Колода не найдена')
}

export async function deleteDeck(deckId: number, userId: number) {
  const res = await db.delete(schema.dictDecks)
    .where(and(eq(schema.dictDecks.id, deckId), eq(schema.dictDecks.userId, userId)))
    .returning({ id: schema.dictDecks.id })

  if (res.length === 0)
    throw new AppError(404, 'Колода не найдена')
}

export async function getUserDictionary(userId: number, targetLang: string): Promise<UserDictItem[]> {
  const words = await db.query.userDictionary.findMany({
    where: and(eq(schema.userDictionary.userId, userId), eq(schema.userDictionary.targetLanguage, targetLang)),
    with: {
      wordToDecks: true,
      encounters: {
        with: { book: { columns: { title: true } } },
      },
    },
    orderBy: [desc(schema.userDictionary.updatedAt)],
  })

  return words.map(w => ({
    ...w,
    deckIds: w.wordToDecks.map((wd: any) => wd.deckId),
  })) as unknown as UserDictItem[]
}

export async function getWordFromUserDictionary(word: string, userId: number, targetLang: string): Promise<UserDictItem | null> {
  const item = await db.query.userDictionary.findFirst({
    where: and(
      eq(schema.userDictionary.word, word),
      eq(schema.userDictionary.userId, userId),
      eq(schema.userDictionary.targetLanguage, targetLang),
    ),
    with: {
      wordToDecks: true,
      encounters: {
        with: { book: { columns: { title: true } } },
      },
    },
  })
  if (!item)
    return null

  return {
    ...item,
    deckIds: item.wordToDecks.map((wd: any) => wd.deckId),
  } as unknown as UserDictItem
}

export async function upsertToUserDictionary(
  item: Partial<UserDictItem> & { contextSentence?: string, contextBookId?: number },
  userId: number,
  targetLang: string,
): Promise<void> {
  if (item.language === targetLang) 
    return

  let deckIds = item.deckIds || []
  if (deckIds.length === 0) {
    let defaultDeck = await db.query.dictDecks.findFirst({
      where: and(
        eq(schema.dictDecks.userId, userId),
        eq(schema.dictDecks.language, item.language || 'en'),
        eq(schema.dictDecks.targetLanguage, targetLang),
      ),
    })
    if (!defaultDeck) {
      const deckName = targetLang === 'ru' ? 'Основная колода' : (targetLang === 'zh' ? '默认词库' : 'Main deck')
      defaultDeck = await createDeck(userId, deckName, item.language || 'en', targetLang)
    }
    deckIds = [defaultDeck.id]
  }

  const emptyCard = createEmptyCard()

  const [upserted] = await db.insert(schema.userDictionary).values({
    userId,
    word: item.word!,
    transcription: item.transcription,
    translation: item.translation,
    language: item.language || 'en',
    targetLanguage: targetLang,
    notes: item.notes,
    tags: item.tags,
    difficulty: item.difficulty,
    grammarNote: item.grammarNote,
    vocabularyNote: item.vocabularyNote,

    state: emptyCard.state,
    due: emptyCard.due.toISOString(),
    stability: emptyCard.stability,
    difficultyFsrs: emptyCard.difficulty,
    scheduledDays: emptyCard.scheduled_days,
    reps: emptyCard.reps,
    lapses: emptyCard.lapses,
    lastReview: null,
    learningSteps: emptyCard.learning_steps ?? 0,

    updatedAt: new Date().toISOString(),
  }).onConflictDoUpdate({
    target: [schema.userDictionary.userId, schema.userDictionary.word, schema.userDictionary.targetLanguage],
    set: {
      transcription: item.transcription,
      translation: item.translation,
      notes: item.notes,
      tags: item.tags,
      difficulty: item.difficulty,
      grammarNote: item.grammarNote,
      vocabularyNote: item.vocabularyNote,
      updatedAt: new Date().toISOString(),
    },
  }).returning({ id: schema.userDictionary.id })

  if (upserted) {
    await db.delete(schema.wordToDeck).where(eq(schema.wordToDeck.wordId, upserted.id))
    if (deckIds.length > 0) {
      const links = deckIds.map(did => ({
        wordId: upserted.id,
        deckId: did,
      }))
      await db.insert(schema.wordToDeck).values(links)
    }
  }

  if (item.contextSentence) {
    await db.insert(schema.wordEncounters).values({
      userId,
      wordId: upserted.id,
      bookId: item.contextBookId || null,
      sentence: item.contextSentence,
    }).onConflictDoNothing()
  }

  await trackActivity(userId, 'added', 1)
}

export async function removeFromUserDictionary(word: string, userId: number, targetLang: string): Promise<void> {
  await db.delete(schema.userDictionary).where(and(
    eq(schema.userDictionary.word, word),
    eq(schema.userDictionary.userId, userId),
    eq(schema.userDictionary.targetLanguage, targetLang),
  ))
}

export async function getReviewQueue(userId: number, language: string | undefined, targetLang: string, mode: 'srs' | 'random' | 'deep_dive' = 'srs', deckId?: number | 'none', difficulty?: string) {
  const filters: any[] = [
    eq(schema.userDictionary.userId, userId),
    eq(schema.userDictionary.targetLanguage, targetLang),
  ]

  if (language && language !== 'all') {
    filters.push(eq(schema.userDictionary.language, language))
  }

  if (deckId === 'none') {
    filters.push(notInArray(schema.userDictionary.id, db.select({ id: schema.wordToDeck.wordId }).from(schema.wordToDeck)))
  }
  else if (deckId !== undefined) {
    filters.push(inArray(schema.userDictionary.id, db.select({ id: schema.wordToDeck.wordId }).from(schema.wordToDeck).where(eq(schema.wordToDeck.deckId, deckId))))
  }

  if (difficulty && difficulty !== 'all') {
    if (difficulty === 'none') {
      filters.push(sql`${schema.userDictionary.difficulty} IS NULL OR ${schema.userDictionary.difficulty} = ''`)
    }
    else {
      filters.push(eq(schema.userDictionary.difficulty, difficulty))
    }
  }

  if (mode === 'srs') {
    const now = new Date().toISOString()
    filters.push(lte(schema.userDictionary.due, now))

    return await db.query.userDictionary.findMany({
      where: and(...filters),
      with: { encounters: true },
      orderBy: [schema.userDictionary.due],
      limit: 50,
    })
  }
  else {
    return await db.query.userDictionary.findMany({
      where: and(...filters),
      with: { encounters: true },
      orderBy: [sql`RANDOM()`],
      limit: 50,
    })
  }
}

export async function processSrsReview(wordId: number, userId: number, grade: number) {
  const word = await db.query.userDictionary.findFirst({
    where: and(eq(schema.userDictionary.id, wordId), eq(schema.userDictionary.userId, userId)),
  })

  if (!word)
    throw new Error('Word not found')

  const fsrs = new FSRS({})

  const card = createEmptyCard()
  card.due = new Date(word.due)
  card.stability = word.stability
  card.difficulty = word.difficultyFsrs
  card.scheduled_days = word.scheduledDays
  card.reps = word.reps
  card.lapses = word.lapses
  card.state = word.state
  card.last_review = word.lastReview ? new Date(word.lastReview) : undefined
  card.learning_steps = word.learningSteps ?? 0

  const now = new Date()
  const schedulingCards = fsrs.repeat(card, now)

  let recordLog
  switch (grade) {
    case Rating.Again: recordLog = schedulingCards[Rating.Again]
      break
    case Rating.Hard: recordLog = schedulingCards[Rating.Hard]
      break
    case Rating.Good: recordLog = schedulingCards[Rating.Good]
      break
    case Rating.Easy: recordLog = schedulingCards[Rating.Easy]
      break
    default: throw new Error('Invalid grade rating')
  }

  await db.update(schema.userDictionary).set({
    due: recordLog.card.due.toISOString(),
    stability: recordLog.card.stability,
    difficultyFsrs: recordLog.card.difficulty,
    scheduledDays: recordLog.card.scheduled_days,
    reps: recordLog.card.reps,
    lapses: recordLog.card.lapses,
    state: recordLog.card.state,
    lastReview: recordLog.card.last_review?.toISOString() || null,
    learningSteps: recordLog.card.learning_steps ?? 0,
    updatedAt: new Date().toISOString(),
  }).where(eq(schema.userDictionary.id, wordId))

  await trackActivity(userId, 'reviewed', 1)
}
