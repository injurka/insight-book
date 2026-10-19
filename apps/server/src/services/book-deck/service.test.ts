import { createClient } from '@libsql/client'
import { afterAll, beforeAll, describe, expect, it, spyOn } from 'bun:test'
import { and, eq, sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/libsql'
import { getTableConfig, SQLiteSyncDialect } from 'drizzle-orm/sqlite-core'
import { db } from '../../db'
import * as schema from '../../db/schema'
import { bookRepository } from '../../repositories/book.repository'
import { compressData, decompressData } from '../../utils/compression'
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
  await database.insert(schema.books).values({
    id: 1,
    userId: 1,
    title: 'Cats',
    filePath: '/test',
    language: 'en',
  })
  await database.insert(schema.bookPages).values([{ bookId: 1, pageNum: 1, content: '<p>The cats watch birds. The cat watched a bird.</p><script>secret</script>' }, { bookId: 1, pageNum: 2, content: '<p>A cat watches birds.</p>' }])
  await database.insert(schema.dictDecks).values({ id: 20, userId: 1, name: 'Old' })
  await database.insert(schema.userDictionary).values([
    {
      id: 30,
      userId: 1,
      word: 'cat',
      language: 'en',
      translation: 'My cat',
      transcription: 'cat',
      difficulty: 'A1',
      tags: 'nature',
      grammarNote: 'noun',
      vocabularyNote: 'animal',
      notes: 'private notes',
      reps: 7,
      stability: 12,
      state: 2,
      due: '2030-01-01',
    },
    {
      id: 31,
      userId: 1,
      word: 'bird',
      language: 'de',
      translation: 'Other language',
    },
    {
      id: 32,
      userId: 2,
      word: 'watch',
      language: 'en',
      translation: 'Other user',
    },
  ])
  await database.insert(schema.wordToDeck).values({ wordId: 30, deckId: 20 })
  await database.insert(schema.llmCache).values({
    sentenceHash: hashSentence('bird', 'en', 'ru'),
    sentence: 'bird',
    language: 'en',
    targetLanguage: 'ru',
    analysis: compressData(JSON.stringify({
      translation: 'птица',
      transcription: 'bird',
      difficulty: 'A1',
      tags: 'nature',
      grammarNote: 'noun',
      vocabularyNote: 'animal',
      grammarRules: [],
      vocabulary: [],
    })),
  })
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
  it('extracts Chinese words without foreign text and filters existing drafts', async () => {
    const [book] = await database.insert(schema.books).values({ userId: 1, title: '中文', filePath: '/test', language: 'zh-CN' }).returning()
    await database.insert(schema.bookPages).values({ bookId: book.id, pageNum: 1, content: '<p>小王子喜欢看日落。小王子喜欢看日落。</p><p>agadir aviator á à English appendix</p><p><ruby>朋友<rt>péng you</rt></ruby>。</p>' })
    const draft = await bookDeckService.open(book.id, 1, 'ru')
    expect(draft.words.length).toBeGreaterThan(0)
    expect(draft.words.every(w => /^\p{Script=Han}+$/u.test(w.word))).toBe(true)
    expect(draft.words.find(w => w.word === '日落')?.count).toBe(2)
    expect(draft.words.some(w => w.word === '朋友')).toBe(true)
    const stale = { ...draft.words[0], word: 'agadir' }
    await database.update(schema.bookDeckDrafts).set({ words: JSON.stringify([...draft.words, stale]) }).where(eq(schema.bookDeckDrafts.id, draft.id))
    const reopened = await bookDeckService.open(book.id, 1, 'ru')
    expect(reopened.id).toBe(draft.id)
    expect(reopened.words).toEqual(draft.words)
    await expect(bookDeckService.generate(
      draft.id,
      'agadir',
      1,
      'ru',
      {} as Parameters<typeof bookDeckService.generate>[4],
    )).rejects.toMatchObject({ statusCode: 400 })
  })
  it('rejects another user or target language', async () => {
    await expect(bookDeckService.open(1, 2, 'ru')).rejects.toMatchObject({ statusCode: 404 })
    await expect(bookDeckService.save(
      draftId,
      2,
      'ru',
      'Stolen',
      ['cat'],
      false,
    )).rejects.toMatchObject({ statusCode: 404 })
    await expect(bookDeckService.save(
      draftId,
      1,
      'en',
      'Wrong',
      ['cat'],
      false,
    )).rejects.toMatchObject({ statusCode: 404 })
  })
  it('rolls back the deck and links if new words lack translations', async () => {
    await expect(bookDeckService.save(
      draftId,
      1,
      'ru',
      'Invalid',
      ['cat', 'watch'],
      false,
    )).rejects.toMatchObject({ statusCode: 400 })
    expect(await database.select().from(schema.dictDecks)).toHaveLength(1)
    expect(await database.select().from(schema.wordToDeck)).toHaveLength(1)
  })
  it('saves atomically, preserves progress and old links, and deduplicates retries', async () => {
    const result = await bookDeckService.save(
      draftId,
      1,
      'ru',
      'Book',
      ['cat', 'bird'],
      false,
    )
    expect(await bookDeckService.save(
      draftId,
      1,
      'ru',
      'Book',
      ['cat', 'bird'],
      false,
    )).toEqual(result)
    expect(await database.query.userDictionary.findFirst({ where: eq(schema.userDictionary.id, 30) })).toMatchObject({
      translation: 'My cat',
      notes: 'private notes',
      reps: 7,
      stability: 12,
      state: 2,
      due: '2030-01-01',
    })
    const links = await database.select().from(schema.wordToDeck).where(eq(schema.wordToDeck.wordId, 30))
    expect(links.map(l => l.deckId)).toEqual([20, result.deckId])
    expect(await database.query.userDictionary.findFirst({ where: and(eq(schema.userDictionary.word, 'bird'), eq(schema.userDictionary.language, 'en')) })).toMatchObject({ translation: 'птица', state: 0, reps: 0 })
    expect(await database.select().from(schema.wordEncounters)).not.toHaveLength(0)
    expect(await database.select().from(schema.dictDecks)).toHaveLength(2)
  })
  it('publishes complete neutral generation to shared cache without book context', async () => {
    const next = await bookDeckService.open(
      1,
      1,
      'ru',
      true,
    )
    const mock = spyOn(analysis, 'generateWordAutoFill').mockResolvedValue({
      translation: 'наблюдать',
      transcription: 'watch',
      difficulty: 'A1',
      tags: 'verb',
      grammarNote: 'verb',
      vocabularyNote: 'usage',
    })

    try {
      const result = await bookDeckService.generate(
        next.id,
        'watch',
        1,
        'ru',
        { url: 'test' },
      )
      expect(result.source).toBe('generated')
      expect((await bookDeckService.open(1, 1, 'ru')).words.find(w => w.word === 'watch')?.content?.translation).toBe('наблюдать')
      const cached = await database.query.llmCache.findFirst({ where: eq(schema.llmCache.sentenceHash, hashSentence('watch', 'en', 'ru')) })
      expect(JSON.parse(decompressData(cached!.analysis))).toMatchObject({ translation: 'наблюдать', difficulty: 'A1', grammarRules: [{ pattern: 'watch', explanation: 'verb', example: '' }] })
      expect(decompressData(cached!.analysis)).not.toContain('contexts')
      expect(await database.query.bookLlmCache.findFirst({ where: eq(schema.bookLlmCache.sentenceHash, hashSentence('watch', 'en', 'ru')) })).toBeUndefined()
      await bookDeckService.save(
        next.id,
        1,
        'ru',
        'Generated',
        ['watch'],
        false,
      )
    }
    finally { mock.mockRestore() }
  })
  it('only replaces regenerated content with permission and keeps FSRS and notes', async () => {
    const next = await bookDeckService.open(
      1,
      1,
      'ru',
      true,
    )
    const words = next.words.map(w => w.word === 'cat'
      ? {
          ...w,
          source: 'generated',
          content: {
            translation: 'кошка',
            transcription: 'cat',
            difficulty: 'A1',
            tags: 'nature',
            grammarNote: 'noun',
            vocabularyNote: 'animal',
          },
        }
      : w)
    await database.update(schema.bookDeckDrafts).set({ words: JSON.stringify(words) }).where(eq(schema.bookDeckDrafts.id, next.id))
    await bookDeckService.save(
      next.id,
      1,
      'ru',
      'Unchanged',
      ['cat'],
      false,
    )
    expect(await database.query.userDictionary.findFirst({ where: eq(schema.userDictionary.id, 30) })).toMatchObject({ translation: 'My cat', reps: 7 })
    const fresh = await bookDeckService.open(
      1,
      1,
      'ru',
      true,
    )
    await database.update(schema.bookDeckDrafts).set({ words: JSON.stringify(words) }).where(eq(schema.bookDeckDrafts.id, fresh.id))
    await bookDeckService.save(
      fresh.id,
      1,
      'ru',
      'Updated',
      ['cat'],
      true,
    )
    expect(await database.query.userDictionary.findFirst({ where: eq(schema.userDictionary.id, 30) })).toMatchObject({ translation: 'кошка', reps: 7, notes: 'private notes' })
    expect(await database.select().from(schema.dailyActivity)).toMatchObject([{ wordsAdded: 2 }])
  })
})

async function personalDraft(userId: number, word: string, content: import('../../types').WordAutoFillResponse | null = null) {
  const [book] = await database.insert(schema.books).values({ userId, title: 'Private', filePath: '/test', language: 'en' }).returning()
  const entry: import('./types').BookDeckWord = {
    word,
    count: 1,
    forms: [word],
    properName: false,
    contexts: [{ sentence: `Private context for ${userId}`, page: 1 }],
    content,
    source: content ? 'cache' : 'missing',
  }
  const id = crypto.randomUUID()
  await database.insert(schema.bookDeckDrafts).values({
    id,
    userId,
    bookId: book.id,
    name: book.title,
    language: 'en',
    targetLanguage: 'ru',
    words: JSON.stringify([entry]),
  })

  return id
}

const sharedContent = {
  translation: 'Общий перевод',
  transcription: 'shared',
  difficulty: 'A1',
  tags: '',
  grammarNote: '',
  vocabularyNote: '',
}

describe('Personal book deck generation isolation', () => {
  it('completes a stale draft from shared cache without AI or overwriting a personal translation', async () => {
    const word = 'cached-completion'
    const sentenceHash = hashSentence(word, 'en', 'ru')
    const analysisData = compressData(JSON.stringify(sharedContent))
    await database.insert(schema.llmCache).values({
      sentenceHash,
      sentence: word,
      language: 'en',
      targetLanguage: 'ru',
      analysis: analysisData,
    })
    const id = await personalDraft(1, word, { ...sharedContent, translation: 'Мой перевод', difficulty: '' })
    const mock = spyOn(analysis, 'generateWordAutoFill').mockRejectedValue(new Error('AI must not run'))

    try {
      const result = await bookDeckService.generate(
        id,
        word,
        1,
        'ru',
        { url: '' },
      )
      expect(result.content).toMatchObject({ translation: 'Мой перевод', difficulty: 'A1' })
      expect(result.source).toBe('cache')
      expect(mock).not.toHaveBeenCalled()
      expect((await database.query.llmCache.findFirst({ where: eq(schema.llmCache.sentenceHash, sentenceHash) }))?.analysis).toEqual(analysisData)
    }
    finally { mock.mockRestore() }
  })

  it('publishes raw generation instead of the merged personal translation', async () => {
    const word = 'neutral-publication'
    const id = await personalDraft(1, word, { ...sharedContent, translation: 'Private translation', difficulty: '' })
    const generated = { ...sharedContent, translation: 'Neutral translation', difficulty: 'B2' }
    const mock = spyOn(analysis, 'generateWordAutoFill').mockResolvedValue(generated)

    try {
      const result = await bookDeckService.generate(
        id,
        word,
        1,
        'ru',
        { url: 'test' },
      )
      expect(result.content?.translation).toBe('Private translation')
      const cached = await database.query.llmCache.findFirst({ where: eq(schema.llmCache.sentenceHash, hashSentence(word, 'en', 'ru')) })
      expect(JSON.parse(decompressData(cached!.analysis))).toMatchObject(generated)
      expect(decompressData(cached!.analysis)).not.toContain('Private')
    }
    finally { mock.mockRestore() }
  })

  it('preserves a cache entry created while generation is in flight and excludes personal fields', async () => {
    const word = 'concurrent-cache'
    const sentenceHash = hashSentence(word, 'en', 'ru')
    const id = await personalDraft(1, word, { ...sharedContent, translation: 'Private translation', difficulty: '' })
    const analysisData = compressData(JSON.stringify(sharedContent))
    const mock = spyOn(analysis, 'generateWordAutoFill').mockImplementation(async () => {
      await database.insert(schema.llmCache).values({
        sentenceHash,
        sentence: word,
        language: 'en',
        targetLanguage: 'ru',
        analysis: analysisData,
      })

      return { ...sharedContent, translation: 'Generated translation', difficulty: 'B2' }
    })

    try {
      const result = await bookDeckService.generate(
        id,
        word,
        1,
        'ru',
        { url: 'test' },
      )
      expect(result.content).toMatchObject({ translation: 'Private translation', difficulty: 'B2' })
      expect((await database.query.llmCache.findFirst({ where: eq(schema.llmCache.sentenceHash, sentenceHash) }))?.analysis).toEqual(analysisData)
    }
    finally { mock.mockRestore() }
  })

  it('keeps partial shared cache unchanged while completing only personal data', async () => {
    const word = 'partial-completion'
    const sentenceHash = hashSentence(word, 'en', 'ru')
    const analysisData = compressData(JSON.stringify({ ...sharedContent, difficulty: '' }))
    await database.insert(schema.llmCache).values({
      sentenceHash,
      sentence: word,
      language: 'en',
      targetLanguage: 'ru',
      analysis: analysisData,
    })
    const id = await personalDraft(1, word, { ...sharedContent, difficulty: '' })
    const mock = spyOn(analysis, 'generateWordAutoFill').mockResolvedValue({ ...sharedContent, translation: 'Новый перевод', difficulty: 'B2' })

    try {
      const result = await bookDeckService.generate(
        id,
        word,
        1,
        'ru',
        { url: 'test' },
      )
      expect(result.content).toMatchObject({ translation: 'Общий перевод', difficulty: 'B2' })
      expect(result.source).toBe('generated')
      expect((await database.query.llmCache.findFirst({ where: eq(schema.llmCache.sentenceHash, sentenceHash) }))?.analysis).toEqual(analysisData)
      expect(await database.query.bookLlmCache.findFirst({ where: eq(schema.bookLlmCache.sentenceHash, sentenceHash) })).toBeUndefined()
    }
    finally { mock.mockRestore() }
  })

  it('regenerates explicitly and saves only the requesting user dictionary', async () => {
    const word = 'personal-regeneration'
    const sentenceHash = hashSentence(word, 'en', 'ru')
    const analysisData = compressData(JSON.stringify(sharedContent))
    await database.insert(schema.llmCache).values({
      sentenceHash,
      sentence: word,
      language: 'en',
      targetLanguage: 'ru',
      analysis: analysisData,
    })
    await database.insert(schema.userDictionary).values({
      userId: 2,
      word,
      language: 'en',
      translation: 'Other user',
      difficulty: 'C1',
      reps: 9,
    })
    const id = await personalDraft(1, word, sharedContent)
    const mock = spyOn(analysis, 'generateWordAutoFill').mockResolvedValue({ ...sharedContent, translation: 'Личный вариант', difficulty: 'B1' })

    try {
      const result = await bookDeckService.generate(
        id,
        word,
        1,
        'ru',
        { url: 'test' },
        true,
      )
      expect(result.content?.translation).toBe('Личный вариант')
      expect(result.source).toBe('generated')
      expect((await database.query.llmCache.findFirst({ where: eq(schema.llmCache.sentenceHash, sentenceHash) }))?.analysis).toEqual(analysisData)
      await bookDeckService.save(
        id,
        1,
        'ru',
        'Private deck',
        [word],
        false,
      )
      expect(await database.query.userDictionary.findFirst({ where: and(eq(schema.userDictionary.userId, 1), eq(schema.userDictionary.word, word)) })).toMatchObject({ translation: 'Личный вариант' })
      expect(await database.query.userDictionary.findFirst({ where: and(eq(schema.userDictionary.userId, 2), eq(schema.userDictionary.word, word)) })).toMatchObject({ translation: 'Other user', reps: 9 })
    }
    finally { mock.mockRestore() }
  })

  it('does not call AI again on a completed draft unless regeneration is explicit', async () => {
    const id = await personalDraft(1, 'completed', sharedContent)
    const mock = spyOn(analysis, 'generateWordAutoFill').mockRejectedValue(new Error('AI must not run'))

    try {
      expect((await bookDeckService.generate(
        id,
        'completed',
        1,
        'ru',
        { url: '' },
      )).content).toEqual(sharedContent)
      expect(mock).not.toHaveBeenCalled()
    }
    finally { mock.mockRestore() }
  })

  it('rejects incomplete generation without changing the draft or shared cache', async () => {
    const id = await personalDraft(1, 'invalid-generation')
    const mock = spyOn(analysis, 'generateWordAutoFill').mockResolvedValue({ ...sharedContent, difficulty: '' })

    try {
      await expect(bookDeckService.generate(
        id,
        'invalid-generation',
        1,
        'ru',
        { url: 'test' },
      )).rejects.toMatchObject({ statusCode: 502 })
      const row = await database.query.bookDeckDrafts.findFirst({ where: eq(schema.bookDeckDrafts.id, id) })
      expect(JSON.parse(row!.words)[0].content).toBeNull()
      expect(await database.query.llmCache.findFirst({ where: eq(schema.llmCache.sentenceHash, hashSentence('invalid-generation', 'en', 'ru')) })).toBeUndefined()
    }
    finally { mock.mockRestore() }
  })
})
