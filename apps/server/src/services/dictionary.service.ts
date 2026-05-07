import type { PageDictEntry, UserDictItem } from '../types'
import { getDictConnection, sqlite } from '../db'

export function lookupWords(words: string[], language: string): Record<string, PageDictEntry> {
  if (!words.length) return {}

  const dict: Record<string, PageDictEntry> = {}

  const chunkSize = 500
  for (let i = 0; i < words.length; i += chunkSize) {
    const chunk = words.slice(i, i + chunkSize)
    const placeholders = chunk.map(() => '?').join(', ')

    const userRows = sqlite.prepare(`
      SELECT word, transcription, translation 
      FROM user_dictionary 
      WHERE word IN (${placeholders})
    `).all(...chunk) as Array<{ word: string, transcription: string, translation: string }>

    for (const row of userRows) {
      const entry = { transcription: row.transcription || '', translation: row.translation || '' }
      dict[row.word] = entry
      dict[row.word.toLowerCase()] = entry
    }
  }

  const conn = getDictConnection(language)
  if (conn) {
    const transcriptionCol = conn.tableName === 'zh_dictionary' ? 'pinyin AS transcription' : 'transcription'

    for (let i = 0; i < words.length; i += chunkSize) {
      const chunk = words.slice(i, i + chunkSize)
      const missingWords = chunk.filter(w => !dict[w] && !dict[w.toLowerCase()])
      if (!missingWords.length) continue

      const placeholders = missingWords.map(() => '?').join(', ')

      try {
        const rows = conn.db.prepare(`
          SELECT word, ${transcriptionCol}, translation
          FROM ${conn.tableName}
          WHERE word IN (${placeholders})
        `).all(...missingWords) as Array<{ word: string, transcription: string, translation: string }>

        for (const row of rows) {
          const entry = { transcription: row.transcription, translation: row.translation }
          dict[row.word] = entry
          dict[row.word.toLowerCase()] = entry
        }
      } catch  {
      }
    }
  }

  return dict
}

export function lookupSingleWord(word: string, language: string): PageDictEntry | null {
  const conn = getDictConnection(language)
  if (!conn)
    return null
  const transcriptionCol = conn.tableName === 'zh_dictionary' ? 'pinyin AS transcription' : 'transcription'
  const row = conn.db.prepare(`SELECT ${transcriptionCol}, translation FROM ${conn.tableName} WHERE word = ? COLLATE NOCASE`).get(word) as { transcription: string, translation: string } | null
  return row ? { transcription: row.transcription, translation: row.translation } : null
}

export function getUserDictionary(): UserDictItem[] {
  return sqlite.prepare(`SELECT * FROM user_dictionary ORDER BY updatedAt DESC`).all() as UserDictItem[]
}

export function getWordFromUserDictionary(word: string): UserDictItem | null {
  return sqlite.prepare(`SELECT * FROM user_dictionary WHERE word = ? COLLATE NOCASE`).get(word) as UserDictItem | null
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
  return sqlite.prepare(`DELETE FROM user_dictionary WHERE word = ? COLLATE NOCASE`).run(word)
}
