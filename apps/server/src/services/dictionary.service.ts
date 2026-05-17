import type { PageDictEntry, UserDictItem } from '../types'
import { and, desc, eq, inArray, lte, sql } from 'drizzle-orm'
import { sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { db, getDictConnection } from '../db'
import * as schema from '../db/schema'
import { AppError } from '../utils/errors'

export async function lookupWords(words: string[], language: string, userId: number): Promise<Record<string, PageDictEntry>> {
  if (!words.length)
    return {}

  const dict: Record<string, PageDictEntry> = {}
  const chunkSize = 500

  // 1. Сначала ищем слова в пользовательском словаре
  for (let i = 0; i < words.length; i += chunkSize) {
    const chunk = words.slice(i, i + chunkSize)

    const userRows = await db.query.userDictionary.findMany({
      where: and(inArray(schema.userDictionary.word, chunk), eq(schema.userDictionary.userId, userId)),
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

  // 2. Ищем ненайденные слова во внешнем словаре
  const conn = getDictConnection(language)
  if (conn) {
    // Динамически строим Drizzle-схему для внешнего словаря
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

        const rows = await conn.dDb
          .select(selection)
          .from(dictTable)
          .where(inArray(dictTable[conn.wordCol], missingWords))

        for (const row of rows) {
          if (!row.word)
            continue
          const entry = {
            transcription: (conn.hasTranscription ? row.transcription : '') || '',
            translation: row.translation || '',
            isUserDict: false,
          }
          // Записываем в двух регистрах, чтобы 100% матчить на клиенте
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

export async function lookupSingleWord(word: string, language: string, userId: number): Promise<PageDictEntry | null> {
  const userWord = await db.query.userDictionary.findFirst({
    where: and(eq(schema.userDictionary.word, word), eq(schema.userDictionary.userId, userId)),
  })
  if (userWord) {
    return { transcription: userWord.transcription || '', translation: userWord.translation || '', isUserDict: true }
  }

  const conn = getDictConnection(language)
  if (!conn)
    return null

  // Динамически строим Drizzle-схему для внешнего словаря
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

    const rows = await conn.dDb.select(selection).from(dictTable).where(sql`${dictTable[conn.wordCol]} = ${word} COLLATE NOCASE`).limit(1)
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

export async function getUserDecks(userId: number) {
  return await db.query.dictDecks.findMany({ where: eq(schema.dictDecks.userId, userId) })
}

export async function createDeck(userId: number, name: string, language: string) {
  const [newDeck] = await db.insert(schema.dictDecks).values({
    userId,
    name,
    language,
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

export async function getUserDictionary(userId: number): Promise<UserDictItem[]> {
  return await db.query.userDictionary.findMany({
    where: eq(schema.userDictionary.userId, userId),
    with: {
      encounters: {
        with: { book: { columns: { title: true } } },
      },
    },
    orderBy: [desc(schema.userDictionary.updatedAt)],
  }) as unknown as UserDictItem[]
}

export async function getWordFromUserDictionary(word: string, userId: number): Promise<UserDictItem | null> {
  const item = await db.query.userDictionary.findFirst({
    where: and(eq(schema.userDictionary.word, word), eq(schema.userDictionary.userId, userId)),
    with: {
      encounters: {
        with: { book: { columns: { title: true } } },
      },
    },
  })
  return (item as unknown as UserDictItem) || null
}

export async function upsertToUserDictionary(
  item: Partial<UserDictItem> & { contextSentence?: string, contextBookId?: number },
  userId: number,
): Promise<void> {
  let deckId = item.deckId
  if (deckId === undefined || deckId === null) {
    let defaultDeck = await db.query.dictDecks.findFirst({
      where: and(eq(schema.dictDecks.userId, userId), eq(schema.dictDecks.language, item.language || 'en')),
    })
    if (!defaultDeck) {
      defaultDeck = await createDeck(userId, 'Основная колода', item.language || 'en')
    }
    deckId = defaultDeck.id
  }

  const [upserted] = await db.insert(schema.userDictionary).values({
    userId,
    deckId,
    word: item.word!,
    transcription: item.transcription,
    translation: item.translation,
    language: item.language || 'en',
    notes: item.notes,
    tags: item.tags,
    difficulty: item.difficulty,
    updatedAt: new Date().toISOString(),
  }).onConflictDoUpdate({
    target: [schema.userDictionary.userId, schema.userDictionary.word],
    set: {
      transcription: item.transcription,
      translation: item.translation,
      notes: item.notes,
      tags: item.tags,
      difficulty: item.difficulty,
      deckId,
      updatedAt: new Date().toISOString(),
    },
  }).returning({ id: schema.userDictionary.id })

  if (item.contextSentence) {
    await db.insert(schema.wordEncounters).values({
      userId,
      wordId: upserted.id,
      bookId: item.contextBookId || null,
      sentence: item.contextSentence,
    }).onConflictDoNothing()
  }
}

export async function removeFromUserDictionary(word: string, userId: number): Promise<void> {
  await db.delete(schema.userDictionary).where(and(eq(schema.userDictionary.word, word), eq(schema.userDictionary.userId, userId)))
}

export async function getReviewQueue(userId: number, language?: string, mode: 'srs' | 'random' = 'srs') {
  const filters: any[] = [
    eq(schema.userDictionary.userId, userId),
  ]

  if (language && language !== 'all') {
    filters.push(eq(schema.userDictionary.language, language))
  }

  if (mode === 'srs') {
    const now = new Date().toISOString()
    filters.push(lte(schema.userDictionary.nextReviewDate, now))

    return await db.query.userDictionary.findMany({
      where: and(...filters),
      with: { encounters: true },
      orderBy: [schema.userDictionary.nextReviewDate],
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

  let { repetitions, interval, easeFactor, status, updatedAt } = word

  const now = Date.now()
  const lastUpdate = new Date(updatedAt).getTime()
  // Фактическое количество прошедших дней с момента последнего ответа
  const daysSinceUpdate = Math.max(0, (now - lastUpdate) / (1000 * 60 * 60 * 24))

  // Берем за основу больший интервал - либо запланированный, либо фактический,
  // чтобы не "штрафовать" пользователя слишком сильно за опоздание
  const actualInterval = Math.max(interval, daysSinceUpdate)

  // Плавная логика шагов интервалов в днях
  if (grade === 0) {
    repetitions = 0
    interval = 1 / 1440
    status = 1
    easeFactor = Math.max(1.3, easeFactor - 0.2)
  }
  else if (grade === 1) {
    easeFactor = Math.max(1.3, easeFactor - 0.15)
    if (repetitions === 0 || interval < 1) {
      interval = 10 / 1440 // 10 минут
      repetitions = 0
    }
    else {
      interval = interval * 1.2
    }
    status = interval < 1 ? 1 : 2
  }
  else if (grade === 2) {
    if (repetitions === 0 || interval < 1) {
      interval = 1 // 1 день
    }
    else {
      interval = actualInterval * easeFactor
    }
    repetitions += 1
    status = interval > 21 ? 3 : 2
  }
  else if (grade === 3) {
    easeFactor += 0.15
    if (repetitions === 0 || interval < 1) {
      interval = 4 // 4 дня
    }
    else {
      interval = actualInterval * easeFactor * 1.3
    }
    repetitions += 1
    status = interval > 21 ? 3 : 2
  }

  const nextDate = new Date(now + interval * 24 * 60 * 60 * 1000)

  await db.update(schema.userDictionary).set({
    repetitions,
    interval,
    easeFactor,
    status,
    nextReviewDate: nextDate.toISOString(),
    updatedAt: new Date().toISOString(),
  }).where(eq(schema.userDictionary.id, wordId))
}
