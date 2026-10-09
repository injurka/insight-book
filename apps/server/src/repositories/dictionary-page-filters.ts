import type { SQL } from 'drizzle-orm'
import type { DictionaryPageOptions } from '../types/dictionary-page'
import { DIFFICULTY_SYSTEMS } from '@injurka/insight-book-language-utils'
import { and, eq, inArray, notInArray, or, sql } from 'drizzle-orm'
import { db } from '../db'
import { userDictionary as words, wordToDeck } from '../db/schema'

export function dictionaryPageFilters(userId: number, targetLang: string, options: DictionaryPageOptions): SQL[] {
  const filters: SQL[] = [eq(words.userId, userId), eq(words.targetLanguage, targetLang)]
  if (options.language && options.language !== 'all')
    filters.push(eq(words.language, options.language))

  const decks = selection(options.decks)
  if (decks.length && !decks.includes('all')) {
    const conditions: SQL[] = []
    if (decks.includes('none'))
      conditions.push(notInArray(words.id, db.select({ id: wordToDeck.wordId }).from(wordToDeck)))
    const ids = decks.filter(id => /^\d+$/.test(id)).map(Number)
    if (ids.length)
      conditions.push(inArray(words.id, db.select({ id: wordToDeck.wordId }).from(wordToDeck).where(inArray(wordToDeck.deckId, ids))))
    filters.push(or(...conditions) || sql`0`)
  }

  const difficulties = selection(options.difficulties)
  if (difficulties.length && !difficulties.includes('all')) {
    const conditions = difficulties.map((value) => {
      if (value === 'none')
        return sql`${words.difficulty} IS NULL OR ${words.difficulty} = ''`
      if (!value.startsWith('level_'))
        return eq(words.difficulty, value)
      const level = Number(value.slice(6))
      const languages = Object.keys(DIFFICULTY_SYSTEMS).filter(language => language !== 'all' && language !== 'default')
      const levels = languages.map(language => and(
        eq(words.language, language),
        inArray(words.difficulty, DIFFICULTY_SYSTEMS[language].filter(item => item.level === level).map(item => item.value)),
      ))
      levels.push(and(
        notInArray(words.language, languages),
        inArray(words.difficulty, DIFFICULTY_SYSTEMS.default.filter(item => item.level === level).map(item => item.value)),
      ))
      return or(...levels) || sql`0`
    })
    filters.push(or(...conditions) || sql`0`)
  }

  const statuses = selection(options.statuses)
  if (statuses.length && !statuses.includes('all'))
    filters.push(inArray(words.state, statuses.map(Number)))

  if (options.search) {
    const fields = [words.word, words.transcription, words.translation, words.notes, words.tags, words.difficulty]
    // instr treats % and _ literally, matching the client substring search.
    const term = options.search.toLowerCase()
    const unicodeLetters = [...new Set([...term].filter(letter => letter.charCodeAt(0) > 127 && letter.toUpperCase().length === 1 && letter.toUpperCase() !== letter))]
    filters.push(or(...fields.map((field) => {
      let lowered: SQL = sql`lower(coalesce(${field}, ''))`
      for (const letter of unicodeLetters)
        lowered = sql`replace(${lowered}, ${letter.toUpperCase()}, ${letter})`
      return sql`instr(${lowered}, ${term}) > 0`
    }))!)
  }
  return filters
}

function selection(value?: string): string[] {
  return value ? value.split(',') : []
}
