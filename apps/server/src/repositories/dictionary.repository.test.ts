import { createClient } from '@libsql/client'
import { afterAll, beforeAll, describe, expect, it, spyOn } from 'bun:test'
import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/libsql'
import { getTableConfig, SQLiteSyncDialect } from 'drizzle-orm/sqlite-core'
import { db } from '../db'
import * as schema from '../db/schema'
import { DictionaryService } from '../services/dictionary.service'
import { DictionaryRepository } from './dictionary.repository'

const client = createClient({ url: 'file::memory:' })
const database = drizzle(client, { schema })
const repository = new DictionaryRepository()

const databaseMocks: { mockRestore: () => void }[] = []

beforeAll(async () => {
  const dialect = new SQLiteSyncDialect()
  for (const table of [schema.users, schema.books, schema.dictDecks, schema.userDictionary, schema.wordToDeck, schema.wordEncounters]) {
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
    { id: 993, username: 'language-identity-test', passwordHash: 'test' },
  ])
  await database.insert(schema.dictDecks).values([
    { id: 991, userId: 991, name: 'Test', language: 'zh' },
    { id: 993, userId: 993, name: 'English', language: 'en' },
    { id: 994, userId: 993, name: 'Book', language: 'en' },
  ])
  await database.insert(schema.userDictionary).values([
    ...Array.from({ length: 115 }, (_, index) => ({
      id: index + 1,
      userId: 991,
      word: `word-${index}`,
      due: index === 0 ? '9999-01-01T00:00:00.000Z' : '2000-01-01T00:00:00.000Z',
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
  await client.execute('CREATE UNIQUE INDEX user_dictionary_userId_word_targetLanguage_unique ON user_dictionary (userId, word, targetLanguage)')
  const before = await database.select().from(schema.userDictionary)
  const links = await database.select().from(schema.wordToDeck)
  await client.executeMultiple(await Bun.file(new URL('../db/migrations/0039_dictionary_source_language.sql', import.meta.url)).text())
  expect(await database.select().from(schema.userDictionary)).toEqual(before)
  expect(await database.select().from(schema.wordToDeck)).toEqual(links)
  databaseMocks.push(
    spyOn(db, 'insert').mockImplementation(database.insert.bind(database)),
    spyOn(db, 'delete').mockImplementation(database.delete.bind(database)),
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

describe('SRS review count', () => {
  it('counts all due cards beyond the queue limit and isolates user and translation language', async () => {
    expect((await repository.getReviewQueue(991, 'all', 'ru')).length).toBe(50)
    expect(await repository.getReviewCount(991, 'all', 'ru')).toEqual({ count: 114 })
    expect(await repository.getReviewCount(992, 'all', 'ru')).toEqual({ count: 1 })
    expect(await repository.getReviewCount(991, 'all', 'en')).toEqual({ count: 1 })
  })

  it('combines multiple decks and levels including uncategorized words', async () => {
    expect(await repository.getReviewCount(991, 'all', 'ru', [991, 'none'], 'A1,HSK 1')).toEqual({ count: 114 })
    expect(await repository.getReviewCount(991, 'all', 'ru', 991, 'A1,HSK 1')).toEqual({ count: 2 })
    expect((await repository.getReviewQueue(991, 'all', 'ru', 'srs', 991, 'A1,HSK 1')).map(word => word.id)).toEqual([2, 4])
    expect(await repository.getReviewCount(991, 'all', 'en', 'none', 'A1,none')).toEqual({ count: 1 })
  })

  it('uses the same language, deck and difficulty filters as the queue', async () => {
    expect(await repository.getReviewCount(991, 'zh', 'ru')).toEqual({ count: 57 })
    expect(await repository.getReviewCount(991, 'zh', 'ru', 991, 'HSK 1')).toEqual({ count: 2 })
    expect(await repository.getReviewCount(991, 'en', 'ru', 991)).toEqual({ count: 0 })
    expect(await repository.getReviewCount(991, 'all', 'ru', 'none')).toEqual({ count: 112 })
    expect(await repository.getReviewCount(991, 'all', 'ru', [991, 'none'])).toEqual({ count: 114 })
  })
})

describe('Dictionary source language identity', () => {
  it('keeps homographs, imports and SRS independent across languages, users and target languages', async () => {
    const english = await repository.upsertWordToDictionary({ userId: 993, word: 'gift', language: 'en', targetLanguage: 'ru', translation: 'подарок', deckIds: [993] })
    const german = await repository.upsertWordToDictionary({ userId: 993, word: 'gift', language: 'de', targetLanguage: 'ru', translation: 'яд', deckIds: [] })
    await database.update(schema.userDictionary).set({ state: 2, reps: 7, stability: 12, due: '2030-01-01T00:00:00.000Z' }).where(sql`${schema.userDictionary.id} = ${english.id}`)
    await repository.upsertClonedWords([{ userId: 993, word: 'gift', language: 'de', targetLanguage: 'ru', translation: 'немецкое значение' }])
    await repository.upsertWordToDictionary({ userId: 993, word: 'gift', language: 'en', targetLanguage: 'ru', translation: 'дар', deckIds: [993, 994] })
    await repository.upsertClonedWords([
      { userId: 993, word: 'gift', language: 'en', targetLanguage: 'zh', translation: '礼物' },
      { userId: 992, word: 'gift', language: 'en', targetLanguage: 'ru', translation: 'другой пользователь' },
    ])
    expect(english.id).not.toBe(german.id)
    expect(await repository.getWordFromUserDictionary('gift', 993, 'ru', 'en')).toMatchObject({ id: english.id, translation: 'дар', state: 2, reps: 7, stability: 12, due: '2030-01-01T00:00:00.000Z', deckIds: [993, 994] })
    expect(await repository.getWordFromUserDictionary('gift', 993, 'ru', 'de')).toMatchObject({ id: german.id, translation: 'немецкое значение', reps: 0 })
    expect(await repository.getWordFromUserDictionary('gift', 993, 'zh', 'en')).toMatchObject({ translation: '礼物' })
    expect(await repository.getWordFromUserDictionary('gift', 992, 'ru', 'en')).toMatchObject({ translation: 'другой пользователь' })
    await expect(repository.getWordFromUserDictionary('gift', 993, 'ru')).rejects.toMatchObject({ statusCode: 409 })
    await expect(repository.removeFromUserDictionary('gift', 993, 'ru')).rejects.toMatchObject({ statusCode: 409 })
    expect(await repository.getWordFromUserDictionary('gift', 993, 'ru', 'en')).not.toBeNull()
    expect(await repository.getWordFromUserDictionary('gift', 993, 'ru', 'de')).not.toBeNull()
    const service = new DictionaryService(repository)
    expect(await service.lookupWords(['gift'], 'de', 'ru', 993)).toEqual({ gift: { translation: 'немецкое значение', transcription: '', isUserDict: true } })
    expect(await service.lookupSingleWord('gift', 'en', 'ru', 993)).toMatchObject({ translation: 'дар' })
    await repository.removeFromUserDictionary('gift', 993, 'ru', 'de')
    expect(await repository.getWordFromUserDictionary('gift', 993, 'ru', 'de')).toBeNull()
    expect(await repository.getWordFromUserDictionary('gift', 993, 'ru')).toMatchObject({ id: english.id, reps: 7 })
    expect(await repository.getWordFromUserDictionary('gift', 993, 'zh', 'en')).not.toBeNull()
    expect(await repository.getWordFromUserDictionary('gift', 992, 'ru', 'en')).not.toBeNull()
    await repository.removeFromUserDictionary('gift', 993, 'ru')
    expect(await repository.getWordFromUserDictionary('gift', 993, 'ru')).toBeNull()
    expect(await repository.getWordFromUserDictionary('gift', 993, 'zh', 'en')).not.toBeNull()
    expect(await repository.getWordFromUserDictionary('gift', 992, 'ru', 'en')).not.toBeNull()
    await repository.removeFromUserDictionary('missing', 993, 'ru')
  })
})
