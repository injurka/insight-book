import type { PageDictEntry, UserDictItem } from '../types'
import { desc, eq, inArray, sql } from 'drizzle-orm'
import { sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { db, getDictConnection } from '../db'
import * as schema from '../db/schema'

export async function lookupWords(words: string[], language: string): Promise<Record<string, PageDictEntry>> {
  if (!words.length)
    return {}

  const dict: Record<string, PageDictEntry> = {}
  const chunkSize = 500

  // 1. Поиск в пользовательском словаре (с использованием Drizzle)
  for (let i = 0; i < words.length; i += chunkSize) {
    const chunk = words.slice(i, i + chunkSize)

    const userRows = await db.query.userDictionary.findMany({
      where: inArray(schema.userDictionary.word, chunk),
      columns: { word: true, transcription: true, translation: true },
    })

    for (const row of userRows) {
      const entry = { transcription: row.transcription || '', translation: row.translation || '' }
      dict[row.word] = entry
      dict[row.word.toLowerCase()] = entry
    }
  }

  // 2. Поиск в системных динамических словарях через Drizzle (динамические таблицы)
  const conn = getDictConnection(language)
  if (conn) {
    // Определяем Drizzle схему таблицы на лету для текущего словаря
    const dictTable = sqliteTable(conn.tableName, {
      word: text('word'),
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
          .select({
            word: dictTable.word,
            transcription: dictTable.transcription,
            translation: dictTable.translation,
          })
          .from(dictTable)
          .where(inArray(dictTable.word, missingWords))

        for (const row of rows) {
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

export async function lookupSingleWord(word: string, language: string): Promise<PageDictEntry | null> {
  const conn = getDictConnection(language)
  if (!conn)
    return null

  // Определяем Drizzle схему таблицы на лету
  const dictTable = sqliteTable(conn.tableName, {
    word: text('word'),
    transcription: text(conn.tableName === 'zh_dictionary' ? 'pinyin' : 'transcription'),
    translation: text('translation'),
  })

  try {
    const rows = await conn.dDb
      .select({
        transcription: dictTable.transcription,
        translation: dictTable.translation,
      })
      .from(dictTable)
      .where(sql`${dictTable.word} = ${word} COLLATE NOCASE`)
      .limit(1)

    if (rows.length > 0) {
      return {
        transcription: rows[0].transcription || '',
        translation: rows[0].translation || '',
      }
    }
  }
  catch (e) {
    console.error(`[Dictionary Error] Failed to lookup single word in ${conn.tableName}:`, e)
  }

  return null
}

export async function getUserDictionary(): Promise<UserDictItem[]> {
  return await db.query.userDictionary.findMany({
    orderBy: [desc(schema.userDictionary.updatedAt)],
  })
}

export async function getWordFromUserDictionary(word: string): Promise<UserDictItem | null> {
  const item = await db.query.userDictionary.findFirst({
    where: eq(schema.userDictionary.word, word),
  })
  return item || null
}

export async function upsertToUserDictionary(item: Omit<UserDictItem, 'id' | 'createdAt' | 'updatedAt'>): Promise<void> {
  await db.insert(schema.userDictionary).values({
    word: item.word,
    transcription: item.transcription,
    translation: item.translation,
    language: item.language,
    notes: item.notes,
    tags: item.tags,
    updatedAt: new Date().toISOString(),
  }).onConflictDoUpdate({
    target: schema.userDictionary.word,
    set: {
      transcription: item.transcription,
      translation: item.translation,
      language: item.language,
      notes: item.notes,
      tags: item.tags,
      updatedAt: new Date().toISOString(),
    },
  })
}

export async function removeFromUserDictionary(word: string): Promise<void> {
  await db.delete(schema.userDictionary).where(eq(schema.userDictionary.word, word))
}
