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

  for (let i = 0; i < words.length; i += chunkSize) {
    const chunk = words.slice(i, i + chunkSize)

    const userRows = await db.query.userDictionary.findMany({
      where: and(inArray(schema.userDictionary.word, chunk), eq(schema.userDictionary.userId, userId)),
      columns: { word: true, transcription: true, translation: true },
    })

    for (const row of userRows) {
      if (!row.word)
        continue
      const entry = { transcription: row.transcription || '', translation: row.translation || '' }
      dict[row.word] = entry
      dict[row.word.toLowerCase()] = entry
    }
  }

  const conn = getDictConnection(language)
  if (conn) {
    const dictTable = sqliteTable(conn.tableName, {
      word: text('word').notNull(),
      transcription: text(conn.tableName === 'zh_dictionary' ? 'pinyin' : 'transcription'),
      translation: text('translation'),
    })

    for (let i = 0; i < words.length; i += chunkSize) {
      const chunk = words.slice(i, i + chunkSize)
      const missingWords = chunk.filter(w => !dict[w] && !dict[w.toLowerCase()])
      if (!missingWords.length)
        continue

      try {
        const rows = await conn.dDb
          .select({ word: dictTable.word, transcription: dictTable.transcription, translation: dictTable.translation })
          .from(dictTable)
          .where(inArray(dictTable.word, missingWords))

        for (const row of rows) {
          if (!row.word)
            continue
          const entry = { transcription: row.transcription || '', translation: row.translation || '' }
          dict[row.word] = entry
          dict[row.word.toLowerCase()] = entry
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
    return { transcription: userWord.transcription || '', translation: userWord.translation || '' }
  }

  const conn = getDictConnection(language)
  if (!conn)
    return null

  const dictTable = sqliteTable(conn.tableName, {
    word: text('word').notNull(),
    transcription: text(conn.tableName === 'zh_dictionary' ? 'pinyin' : 'transcription'),
    translation: text('translation'),
  })

  try {
    const rows = await conn.dDb.select().from(dictTable).where(sql`${dictTable.word} = ${word} COLLATE NOCASE`).limit(1)
    if (rows.length > 0)
      return { transcription: rows[0].transcription || '', translation: rows[0].translation || '' }
  }
  catch { }

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

export async function getReviewQueue(userId: number, language?: string, forceAll: boolean = false) {
  const now = new Date().toISOString()

  const filters: any[] = [
    eq(schema.userDictionary.userId, userId),
  ]

  if (language && language !== 'all') {
    filters.push(eq(schema.userDictionary.language, language))
  }

  if (!forceAll) {
    filters.push(lte(schema.userDictionary.nextReviewDate, now))
  }

  return await db.query.userDictionary.findMany({
    where: and(...filters),
    with: { encounters: true },
    orderBy: [schema.userDictionary.nextReviewDate],
    limit: 50,
  })
}

export async function processSrsReview(wordId: number, userId: number, grade: number) {
  const word = await db.query.userDictionary.findFirst({
    where: and(eq(schema.userDictionary.id, wordId), eq(schema.userDictionary.userId, userId)),
  })

  if (!word)
    throw new Error('Word not found')

  let { repetitions, interval, easeFactor, status } = word

  if (grade === 0) {
    repetitions = 0
    interval = 1
    status = 1 // Learning
    easeFactor = Math.max(1.3, easeFactor - 0.2)
  }
  else {
    if (repetitions === 0) {
      interval = 1
    }
    else if (repetitions === 1) {
      interval = 6
    }
    else {
      interval = Math.round(interval * easeFactor)
    }

    const gradeVal = grade === 1 ? 3 : grade === 2 ? 4 : 5
    easeFactor = easeFactor + (0.1 - (5 - gradeVal) * (0.08 + (5 - gradeVal) * 0.02))
    easeFactor = Math.max(1.3, easeFactor)

    repetitions += 1
    status = interval > 21 ? 3 : 2
  }

  const nextDate = new Date()
  nextDate.setDate(nextDate.getDate() + interval)

  await db.update(schema.userDictionary).set({
    repetitions,
    interval,
    easeFactor,
    status,
    nextReviewDate: nextDate.toISOString(),
    updatedAt: new Date().toISOString(),
  }).where(eq(schema.userDictionary.id, wordId))
}
