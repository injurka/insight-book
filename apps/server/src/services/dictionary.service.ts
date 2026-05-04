import type { PageDictEntry, UserDictItem } from '../types'
import { db, dictDb } from '../db'

export function lookupWords(words: string[]): Record<string, PageDictEntry> {
  if (!words.length)
    return {}

  const placeholders = words.map(() => '?').join(', ')
  const rows = dictDb.prepare(`
    SELECT word, pinyin, translation
    FROM zh_dictionary
    WHERE word IN (${placeholders})
  `).all(...words) as Array<{ word: string, pinyin: string, translation: string }>

  const dict: Record<string, PageDictEntry> = {}
  for (const row of rows) {
    dict[row.word] = { pinyin: row.pinyin, translation: row.translation }
  }
  return dict
}

export function lookupSingleWord(word: string): PageDictEntry | null {
  const row = dictDb.prepare(`
    SELECT pinyin, translation FROM zh_dictionary WHERE word = ?
  `).get(word) as { pinyin: string, translation: string } | null
  return row ? { pinyin: row.pinyin, translation: row.translation } : null
}

export function getUserDictionary(): UserDictItem[] {
  return db.prepare(`SELECT * FROM user_dictionary ORDER BY updatedAt DESC`).all() as UserDictItem[]
}

export function getWordFromUserDictionary(word: string): UserDictItem | null {
  return db.prepare(`SELECT * FROM user_dictionary WHERE word = ?`).get(word) as UserDictItem | null
}

export function upsertToUserDictionary(item: Omit<UserDictItem, 'id' | 'createdAt' | 'updatedAt'>) {
  return db.prepare(`
    INSERT INTO user_dictionary (word, pinyin, translation, notes, tags, updatedAt)
    VALUES (?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(word) DO UPDATE SET
      pinyin = excluded.pinyin,
      translation = excluded.translation,
      notes = excluded.notes,
      tags = excluded.tags,
      updatedAt = datetime('now')
  `).run(item.word, item.pinyin, item.translation, item.notes || null, item.tags || null)
}

export function removeFromUserDictionary(word: string) {
  return db.prepare(`DELETE FROM user_dictionary WHERE word = ?`).run(word)
}
