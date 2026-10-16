import { createClient } from '@libsql/client'
import { afterAll, beforeAll, describe, expect, it, spyOn } from 'bun:test'
import { and, eq, sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/libsql'
import { getTableConfig, SQLiteSyncDialect } from 'drizzle-orm/sqlite-core'
import { db } from '../../db'
import * as schema from '../../db/schema'
import { bookRepository } from '../../repositories/book.repository'
import { compressData } from '../../utils/compression'
import { hashSentence } from '../../utils/helpers'
import * as worker from '../../workers/worker-client'
import * as analysis from '../word-analysis.service'
import { extractBookDeckWords } from './extract'
import { bookDeckService } from './service'

const client = createClient({ url: 'file::memory:' })
const database = drizzle(client, { schema })
const mocks: { mockRestore: () => void }[] = []
let draftId = ''

beforeAll(async () => {
  const dialect = new SQLiteSyncDialect()
  for (const table of [schema.users, schema.books, schema.bookPages, schema.dictDecks, schema.userDictionary, schema.wordToDeck, schema.wordEncounters, schema.llmCache, schema.bookLlmCache, schema.dailyActivity]) {
    const config = getTableConfig(table)
    const columns = config.columns.map((c) => {
      const value = c.default === undefined ? '' : ` DEFAULT ${dialect.sqlToQuery(sql`${c.default}`.inlineParams()).sql}`
      return `"${c.name}" ${c.getSQLType()}${c.primary ? ' PRIMARY KEY' : ''}${c.notNull ? ' NOT NULL' : ''}${value}`
    })
    for (const key of config.primaryKeys) columns.push(`PRIMARY KEY (${key.columns.map(c => `"${c.name}"`).join(',')})`)
    for (const key of config.uniqueConstraints) columns.push(`UNIQUE (${key.columns.map(c => `"${c.name}"`).join(',')})`)
    await database.run(sql.raw(`CREATE TABLE "${config.name}" (${columns.join(',')})`))
  }
  await client.executeMultiple(await Bun.file(new URL('../../db/migrations/0040_book_deck_drafts.sql', import.meta.url)).text())
  await database.insert(schema.users).values([{ id: 1, username: 'owner', passwordHash: 'x' }, { id: 2, username: 'other', passwordHash: 'x' }])
  await database.insert(schema.books).values({ id: 1, userId: 1, title: 'Cats', filePath: '/test', language: 'en' })
  await database.insert(schema.bookPages).values([{ bookId: 1, pageNum: 1, content: '<p>The cats watch birds. The cat watched a bird.</p><script>secret</script>' }, { bookId: 1, pageNum: 2, content: '<p>A cat watches birds.</p>' }])
  await database.insert(schema.dictDecks).values({ id: 20, userId: 1, name: 'Old' })
  await database.insert(schema.userDictionary).values([
    { id: 30, userId: 1, word: 'cat', language: 'en', translation: 'My cat', notes: 'private notes', reps: 7, stability: 12, state: 2, due: '2030-01-01' },
    { id: 31, userId: 1, word: 'bird', language: 'de', translation: 'Other language' },
    { id: 32, userId: 2, word: 'watch', language: 'en', translation: 'Other user' },
  ])
  await database.insert(schema.wordToDeck).values({ wordId: 30, deckId: 20 })
  await database.insert(schema.llmCache).values({ sentenceHash: hashSentence('bird', 'en', 'ru'), sentence: 'bird', language: 'en', targetLanguage: 'ru', analysis: compressData(JSON.stringify({ translation: 'птица', transcription: 'bird', grammarRules: [], vocabulary: [] })) })
  mocks.push(
    spyOn(db, 'select').mockImplementation(database.select.bind(database)),
    spyOn(db, 'insert').mockImplementation(database.insert.bind(database)),
    spyOn(db, 'transaction').mockImplementation(database.transaction.bind(database)),
    spyOn(db.query.bookDeckDrafts, 'findFirst').mockImplementation(database.query.bookDeckDrafts.findFirst.bind(database.query.bookDeckDrafts)),
    spyOn(bookRepository, 'getBookById').mockImplementation(async (id, userId) => {
      const book = await database.query.books.findFirst({ where: eq(schema.books.id, id) })
      return book && book.userId === userId ? { ...book, progresses: [], stats: null! } : undefined
    }),
    spyOn(worker, 'runWorkerTask').mockImplementation(async (_type, payload) => {
      const p = payload as { bookId: number, language: string }
      return await extractBookDeckWords(p.bookId, p.language) as never
    }),
  )
})
afterAll(() => {
  for (const mock of mocks) mock.mockRestore()
  worker.terminatePool()
  client.close()
})

describe('Book deck lifecycle', () => {
  it('extracts every page, groups forms and distinguishes dictionary, cache and missing data', async () => {
    const draft = await bookDeckService.open(1, 1, 'ru')
    draftId = draft.id
    const cat = draft.words.find(w => w.word === 'cat')!
    expect(cat.count).toBe(3)
    expect(cat.forms).toContain('cats')
    expect(cat.contexts.map(c => c.page)).toContain(2)
    expect(cat.source).toBe('dictionary')
    expect(cat.content?.translation).toBe('My cat')
    expect(draft.words.find(w => w.word === 'bird')?.source).toBe('cache')
    expect(draft.words.find(w => w.word === 'watch')?.source).toBe('missing')
    expect(draft.words.some(w => w.word === 'secret')).toBe(false)
    expect((await bookDeckService.open(1, 1, 'ru')).id).toBe(draftId)
  })
  it('rejects another user or target language', async () => {
    await expect(bookDeckService.open(1, 2, 'ru')).rejects.toMatchObject({ statusCode: 404 })
    await expect(bookDeckService.save(draftId, 2, 'ru', 'Stolen', ['cat'], false)).rejects.toMatchObject({ statusCode: 404 })
    await expect(bookDeckService.save(draftId, 1, 'en', 'Wrong', ['cat'], false)).rejects.toMatchObject({ statusCode: 404 })
  })
  it('rolls back the deck and links if new words lack translations', async () => {
    await expect(bookDeckService.save(draftId, 1, 'ru', 'Invalid', ['cat', 'watch'], false)).rejects.toMatchObject({ statusCode: 400 })
    expect(await database.select().from(schema.dictDecks)).toHaveLength(1)
    expect(await database.select().from(schema.wordToDeck)).toHaveLength(1)
  })
  it('saves atomically, preserves progress and old links, and deduplicates retries', async () => {
    const result = await bookDeckService.save(draftId, 1, 'ru', 'Book', ['cat', 'bird'], false)
    expect(await bookDeckService.save(draftId, 1, 'ru', 'Book', ['cat', 'bird'], false)).toEqual(result)
    expect(await database.query.userDictionary.findFirst({ where: eq(schema.userDictionary.id, 30) })).toMatchObject({ translation: 'My cat', notes: 'private notes', reps: 7, stability: 12, state: 2, due: '2030-01-01' })
    const links = await database.select().from(schema.wordToDeck).where(eq(schema.wordToDeck.wordId, 30))
    expect(links.map(l => l.deckId)).toEqual([20, result.deckId])
    expect(await database.query.userDictionary.findFirst({ where: and(eq(schema.userDictionary.word, 'bird'), eq(schema.userDictionary.language, 'en')) })).toMatchObject({ translation: 'птица', state: 0, reps: 0 })
    expect(await database.select().from(schema.wordEncounters)).not.toHaveLength(0)
    expect(await database.select().from(schema.dictDecks)).toHaveLength(2)
  })
  it('persists generated content and populates reusable AI cache', async () => {
    const next = await bookDeckService.open(1, 1, 'ru', true)
    const mock = spyOn(analysis, 'generateWordAutoFill').mockResolvedValue({ translation: 'наблюдать', transcription: 'watch', difficulty: 'A1', tags: 'verb', grammarNote: 'verb', vocabularyNote: 'usage' })
    try {
      const result = await bookDeckService.generate(next.id, 'watch', 1, 'ru', { url: 'test' })
      expect(result.source).toBe('generated')
      expect((await bookDeckService.open(1, 1, 'ru')).words.find(w => w.word === 'watch')?.content?.translation).toBe('наблюдать')
      expect(await database.query.llmCache.findFirst({ where: eq(schema.llmCache.sentenceHash, hashSentence('watch', 'en', 'ru')) })).toBeDefined()
      await bookDeckService.save(next.id, 1, 'ru', 'Generated', ['watch'], false)
    }
    finally { mock.mockRestore() }
  })
  it('only replaces regenerated content with permission and keeps FSRS and notes', async () => {
    const next = await bookDeckService.open(1, 1, 'ru', true)
    const words = next.words.map(w => w.word === 'cat' ? { ...w, source: 'generated', content: { translation: 'кошка', transcription: '', difficulty: '', tags: '', grammarNote: '', vocabularyNote: '' } } : w)
    await database.update(schema.bookDeckDrafts).set({ words: JSON.stringify(words) }).where(eq(schema.bookDeckDrafts.id, next.id))
    await bookDeckService.save(next.id, 1, 'ru', 'Unchanged', ['cat'], false)
    expect(await database.query.userDictionary.findFirst({ where: eq(schema.userDictionary.id, 30) })).toMatchObject({ translation: 'My cat', reps: 7 })
    const fresh = await bookDeckService.open(1, 1, 'ru', true)
    await database.update(schema.bookDeckDrafts).set({ words: JSON.stringify(words) }).where(eq(schema.bookDeckDrafts.id, fresh.id))
    await bookDeckService.save(fresh.id, 1, 'ru', 'Updated', ['cat'], true)
    expect(await database.query.userDictionary.findFirst({ where: eq(schema.userDictionary.id, 30) })).toMatchObject({ translation: 'кошка', reps: 7, notes: 'private notes' })
    expect(await database.select().from(schema.dailyActivity)).toMatchObject([{ wordsAdded: 2 }])
  })
})
