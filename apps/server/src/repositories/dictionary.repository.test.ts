import { createClient } from '@libsql/client'
import { afterAll, beforeAll, describe, expect, it, spyOn } from 'bun:test'
import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/libsql'
import { getTableConfig, SQLiteSyncDialect } from 'drizzle-orm/sqlite-core'
import { db } from '../db'
import * as schema from '../db/schema'
import { DictionaryRepository } from './dictionary.repository'

const client = createClient({ url: 'file::memory:' })
const database = drizzle(client, { schema })
const repository = new DictionaryRepository()

const databaseMocks: { mockRestore: () => void }[] = []

beforeAll(async () => {
  const dialect = new SQLiteSyncDialect()
  for (const table of [schema.users, schema.dictDecks, schema.userDictionary, schema.wordToDeck, schema.wordEncounters]) {
    const config = getTableConfig(table)
    const columns = config.columns.map((column) => {
      const defaultValue = column.default === undefined ? '' : ` DEFAULT ${dialect.sqlToQuery(sql`${column.default}`.inlineParams()).sql}`
      return `"${column.name}" ${column.getSQLType()}${column.primary ? ' PRIMARY KEY' : ''}${defaultValue}`
    })
    await database.run(sql.raw(`CREATE TABLE "${config.name}" (${columns.join(',')})`))
  }
  await database.insert(schema.users).values([
    { id: 991, username: 'pagination-test', passwordHash: 'test' },
    { id: 992, username: 'other-pagination-test', passwordHash: 'test' },
  ])
  await database.insert(schema.dictDecks).values({ id: 991, userId: 991, name: 'Test', language: 'zh' })
  await database.insert(schema.userDictionary).values([
    ...Array.from({ length: 115 }, (_, index) => ({
      id: index + 1,
      userId: 991,
      word: `word-${index}`,
      updatedAt: '2026-10-09',
      language: index % 2 ? 'zh' : 'en',
      difficulty: index % 2 ? 'HSK 1' : 'A1',
      state: index % 4,
      notes: index === 0 ? 'ПрИвЕт 100%_test' : null,
    })),
    { id: 200, userId: 992, word: 'other-user' },
    { id: 201, userId: 991, word: 'other-target', targetLanguage: 'en' },
  ])
  await database.insert(schema.wordToDeck).values([{ wordId: 2, deckId: 991 }, { wordId: 4, deckId: 991 }])
  await database.insert(schema.wordEncounters).values({ wordId: 1, userId: 991, sentence: 'Large context' })
  databaseMocks.push(
    spyOn(db, 'select').mockImplementation(database.select.bind(database)),
    spyOn(db.query.userDictionary, 'findMany').mockImplementation(database.query.userDictionary.findMany.bind(database.query.userDictionary)),
  )
})
afterAll(() => {
  for (const databaseMock of databaseMocks)
    databaseMock.mockRestore()
  client.close()
})

describe('Dictionary pagination', () => {
  it('returns bounded stable pages without duplicates or encounters, with complete counts', async () => {
    const ids: number[] = []
    let offset: number | null = 0
    while (offset !== null) {
      const page = await repository.getUserDictionaryPage(991, 'ru', { offset, limit: 50 })
      expect(page.items.length).toBeLessThanOrEqual(50)
      expect(page.total).toBe(115)
      expect(page.totalWords).toBe(115)
      expect(page.languages.sort()).toEqual(['en', 'zh'])
      expect(page.deckCounts).toEqual([{ deckId: 991, count: 2 }])
      expect(page.items.every(item => !('encounters' in item))).toBe(true)
      ids.push(...page.items.map(item => item.id))
      offset = page.nextOffset
    }
    expect(ids).toEqual(Array.from({ length: 115 }, (_, index) => 115 - index))
  })

  it('searches words beyond the first page with literal wildcards and Unicode case folding', async () => {
    const page = await repository.getUserDictionaryPage(991, 'ru', { offset: 0, limit: 50, search: 'привет 100%_' })
    expect(page.items.map(item => item.id)).toEqual([1])
  })

  it('filters decks, level, status and language before applying the limit', async () => {
    const page = await repository.getUserDictionaryPage(991, 'ru', {
      offset: 0,
      limit: 1,
      decks: '991',
      difficulties: 'level_1',
      statuses: '1,3',
      language: 'zh',
    })
    expect(page.total).toBe(2)
    expect(page.items.map(item => item.id)).toEqual([4])
    expect(page.nextOffset).toBe(1)
    const withoutDeck = await repository.getUserDictionaryPage(991, 'ru', { offset: 0, limit: 50, decks: 'none' })
    expect(withoutDeck.total).toBe(113)
    expect(withoutDeck.items.every(item => !item.deckIds.length)).toBe(true)
  })
})
