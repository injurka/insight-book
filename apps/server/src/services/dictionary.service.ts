import type { PageDictEntry, UserDictItem } from '../types'
import { getDictConnection, sqlite } from '../db'

export function lookupWords(words: string[], language: string): Record<string, PageDictEntry> {
  if (!words.length)
    return {}

  const conn = getDictConnection(language)
  if (!conn)
    return {}

  const placeholders = words.map(() => '?').join(', ')

  const transcriptionCol = conn.tableName === 'zh_dictionary' ? 'pinyin AS transcription' : 'transcription'

  const rows = conn.db.prepare(`
    SELECT word, ${transcriptionCol}, translation
    FROM ${conn.tableName}
    WHERE word IN (${placeholders})
  `).all(...words) as Array<{ word: string, transcription: string, translation: string }>

  const dict: Record<string, PageDictEntry> = {}
  for (const row of rows) {
    dict[row.word] = { transcription: row.transcription, translation: row.translation }
  }
  return dict
}

export function lookupSingleWord(word: string, language: string): PageDictEntry | null {
  const conn = getDictConnection(language)
  if (!conn)
    return null

  const transcriptionCol = conn.tableName === 'zh_dictionary' ? 'pinyin AS transcription' : 'transcription'

  const row = conn.db.prepare(`
    SELECT ${transcriptionCol}, translation 
    FROM ${conn.tableName} 
    WHERE word = ?
  `).get(word) as { transcription: string, translation: string } | null

  return row ? { transcription: row.transcription, translation: row.translation } : null
}

export function getUserDictionary(): UserDictItem[] {
  return sqlite.prepare(`SELECT * FROM user_dictionary ORDER BY updatedAt DESC`).all() as UserDictItem[]
}

export function getWordFromUserDictionary(word: string): UserDictItem | null {
  return sqlite.prepare(`SELECT * FROM user_dictionary WHERE word = ?`).get(word) as UserDictItem | null
}

export function upsertToUserDictionary(item: Omit<UserDictItem, 'id' | 'createdAt' | 'updatedAt'>) {
  return sqlite.prepare(`
    INSERT INTO user_dictionary (word, transcription, translation, language, notes, tags, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(word) DO UPDATE SET
      transcription = excluded.transcription,
      translation = excluded.translation,
      language = excluded.language,
      notes = excluded.notes,
      tags = excluded.tags,
      updatedAt = datetime('now')
  `).run(item.word, item.transcription, item.translation, item.language, item.notes || null, item.tags || null)
}

export function removeFromUserDictionary(word: string) {
  return sqlite.prepare(`DELETE FROM user_dictionary WHERE word = ?`).run(word)
}
