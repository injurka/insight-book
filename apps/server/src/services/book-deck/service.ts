import type { LlmAnalysis, LlmConfig, WordAutoFillResponse } from '../../types'
import type { BookDeckDraft, BookDeckWord } from './types'
import { and, eq, inArray, sql } from 'drizzle-orm'
import { db } from '../../db'
import * as schema from '../../db/schema'
import { bookRepository } from '../../repositories/book.repository'
import { compressData, decompressData } from '../../utils/compression'
import { AppError } from '../../utils/errors'
import { hashSentence, normalizeLanguageCode } from '../../utils/helpers'
import { singleflight } from '../../utils/singleflight'
import { runWorkerTask } from '../../workers/worker-client'
import { generateWordAutoFill } from '../word-analysis.service'

function contentOf(value: Partial<WordAutoFillResponse>): WordAutoFillResponse | null {
  if (typeof value.translation !== 'string' || !value.translation.trim())
    return null
  const text = (key: keyof WordAutoFillResponse) => typeof value[key] === 'string' ? value[key] : ''
  return { translation: value.translation, transcription: text('transcription'), difficulty: text('difficulty'), tags: text('tags'), grammarNote: text('grammarNote'), vocabularyNote: text('vocabularyNote') }
}

function toDraft(row: typeof schema.bookDeckDrafts.$inferSelect): BookDeckDraft {
  return { ...row, words: JSON.parse(row.words) as BookDeckWord[] }
}

async function accessibleBook(bookId: number, userId: number) {
  const book = await bookRepository.getBookById(bookId, userId)
  if (!book)
    throw new AppError(404, 'Book not found')
  if (book.type === 'manga')
    throw new AppError(400, 'A processed text book is required')
  return book
}

async function ownedDraft(id: string, userId: number, targetLanguage: string) {
  const row = await db.query.bookDeckDrafts.findFirst({ where: and(eq(schema.bookDeckDrafts.id, id), eq(schema.bookDeckDrafts.userId, userId), eq(schema.bookDeckDrafts.targetLanguage, targetLanguage)) })
  if (!row)
    throw new AppError(404, 'Draft not found')
  await accessibleBook(row.bookId, userId)
  return toDraft(row)
}

async function resolveContents(words: BookDeckWord[], userId: number, language: string, targetLanguage: string) {
  for (let offset = 0; offset < words.length; offset += 100) {
    const batch = words.slice(offset, offset + 100)
    const dictionary = await db.select().from(schema.userDictionary).where(and(eq(schema.userDictionary.userId, userId), eq(schema.userDictionary.language, language), eq(schema.userDictionary.targetLanguage, targetLanguage), inArray(schema.userDictionary.word, batch.map(w => w.word))))
    const cache = await db.select().from(schema.llmCache).where(and(eq(schema.llmCache.language, language), eq(schema.llmCache.targetLanguage, targetLanguage), inArray(schema.llmCache.sentenceHash, batch.map(w => hashSentence(w.word, language, targetLanguage)))))
    for (const word of batch) {
      const entry = dictionary.find(d => d.word === word.word)
      if (entry) {
        word.dictionaryId = entry.id
        word.source = 'dictionary'
        word.content = contentOf({ translation: entry.translation || '', transcription: entry.transcription || '', difficulty: entry.difficulty || '', tags: entry.tags || '', grammarNote: entry.grammarNote || '', vocabularyNote: entry.vocabularyNote || '' })
      }
      if (!word.content) {
        const cached = cache.find(c => c.sentenceHash === hashSentence(word.word, language, targetLanguage))
        try {
          if (cached) {
            const parsed: LlmAnalysis = JSON.parse(decompressData(cached.analysis))
            word.content = contentOf({ ...parsed, grammarNote: contentOf(parsed)?.grammarNote || (Array.isArray(parsed.grammarRules) ? parsed.grammarRules.filter(r => typeof r.pattern === 'string' && typeof r.explanation === 'string').map(r => `${r.pattern} — ${r.explanation}`).join('\n') : ''), vocabularyNote: contentOf(parsed)?.vocabularyNote || (Array.isArray(parsed.vocabulary) ? parsed.vocabulary.filter(v => typeof v.word === 'string' && typeof v.meaning === 'string').map(v => `${v.word} — ${v.meaning}`).join('\n') : '') })
            if (word.content && !entry)
              word.source = 'cache'
          }
        }
        catch { /* Corrupt cache remains a generation candidate. */ }
      }
    }
  }
}

export const bookDeckService = {
  async open(bookId: number, userId: number, targetLanguage: string, restart = false) {
    return singleflight.do(`book-deck-open:${userId}:${bookId}:${targetLanguage}`, async () => {
      const book = await accessibleBook(bookId, userId)
      const previous = await db.query.bookDeckDrafts.findFirst({ where: and(eq(schema.bookDeckDrafts.userId, userId), eq(schema.bookDeckDrafts.bookId, bookId), eq(schema.bookDeckDrafts.targetLanguage, targetLanguage)) })
      if (previous && !restart)
        return toDraft(previous)
      if (previous && !previous.deckId)
        throw new AppError(409, 'Finish the current draft first')
      const language = normalizeLanguageCode(book.language)
      const words = await runWorkerTask<BookDeckWord[]>('extractBookDeckWords', { bookId, language })
      if (!words.length)
        throw new AppError(400, 'No words found')
      await resolveContents(words, userId, language, targetLanguage)
      const draft: BookDeckDraft = { id: crypto.randomUUID(), bookId, name: book.title, language, targetLanguage, words, deckId: null }
      const values = { ...draft, userId, words: JSON.stringify(words) }
      await db.insert(schema.bookDeckDrafts).values(values).onConflictDoUpdate({ target: [schema.bookDeckDrafts.userId, schema.bookDeckDrafts.bookId, schema.bookDeckDrafts.targetLanguage], set: values })
      return draft
    })
  },

  async generate(id: string, word: string, userId: number, targetLanguage: string, config: LlmConfig) {
    return singleflight.do(`book-deck-generate:${id}:${word}:${userId}`, async () => {
      const draft = await ownedDraft(id, userId, targetLanguage)
      if (draft.deckId)
        throw new AppError(409, 'Draft already saved')
      if (!draft.words.some(w => w.word === word))
        throw new AppError(400, 'Word does not belong to this draft')
      const content = contentOf(await generateWordAutoFill(userId, word, draft.language, targetLanguage, config))
      if (!content)
        throw new AppError(502, 'AI returned no translation')
      return db.transaction(async (tx) => {
        const row = await tx.query.bookDeckDrafts.findFirst({ where: eq(schema.bookDeckDrafts.id, id) })
        if (!row || row.deckId)
          throw new AppError(409, 'Draft already saved or replaced')
        const words: BookDeckWord[] = JSON.parse(row.words)
        const entry = words.find(w => w.word === word)!
        const hash = hashSentence(word, draft.language, targetLanguage)
        await tx.insert(schema.llmCache).values({ sentenceHash: hash, language: draft.language, targetLanguage, sentence: word, analysis: compressData(JSON.stringify({ ...content, grammarRules: [], vocabulary: [] })) }).onConflictDoUpdate({ target: schema.llmCache.sentenceHash, set: { analysis: compressData(JSON.stringify({ ...content, grammarRules: [], vocabulary: [] })) } })
        await tx.insert(schema.bookLlmCache).values({ bookId: draft.bookId, sentenceHash: hash, type: 'word' }).onConflictDoNothing()
        entry.content = content
        entry.source = 'generated'
        await tx.update(schema.bookDeckDrafts).set({ words: JSON.stringify(words), updatedAt: sql`(datetime('now'))` }).where(eq(schema.bookDeckDrafts.id, id))
        return entry
      })
    })
  },

  async save(id: string, userId: number, targetLanguage: string, name: string, selectedWords: string[], updateExisting: boolean) {
    await ownedDraft(id, userId, targetLanguage)
    return db.transaction(async (tx) => {
      const row = await tx.query.bookDeckDrafts.findFirst({ where: and(eq(schema.bookDeckDrafts.id, id), eq(schema.bookDeckDrafts.userId, userId)) })
      if (!row)
        throw new AppError(404, 'Draft not found')
      if (row.deckId)
        return { deckId: row.deckId }
      const allWords: BookDeckWord[] = JSON.parse(row.words)
      const selected = new Set(selectedWords)
      const words = allWords.filter(w => selected.has(w.word))
      if (!name.trim() || !words.length || words.length !== selected.size)
        throw new AppError(400, 'Choose words and a deck name')
      const [deck] = await tx.insert(schema.dictDecks).values({ userId, name: name.trim(), language: row.language, targetLanguage }).returning()
      let addedWords = 0
      for (let offset = 0; offset < words.length; offset += 50) {
        const batch = words.slice(offset, offset + 50)
        const existing = await tx.select().from(schema.userDictionary).where(and(eq(schema.userDictionary.userId, userId), eq(schema.userDictionary.language, row.language), eq(schema.userDictionary.targetLanguage, targetLanguage), inArray(schema.userDictionary.word, batch.map(w => w.word))))
        const byWord = new Map(existing.map(w => [w.word, w]))
        const missing = batch.filter(w => !byWord.has(w.word))
        if (batch.some(w => !w.content && !byWord.get(w.word)?.translation?.trim()))
          throw new AppError(400, 'All new words need a translation')
        if (missing.length) {
          const added = await tx.insert(schema.userDictionary).values(missing.map(w => ({ userId, word: w.word, language: row.language, targetLanguage, ...w.content! }))).returning()
          addedWords += added.length
          for (const entry of added) byWord.set(entry.word, entry)
        }
        for (const word of batch.filter(w => w.content && existing.some(e => e.word === w.word))) {
          const old = byWord.get(word.word)!
          const content = word.content!
          if (updateExisting && word.source === 'generated') {
            await tx.update(schema.userDictionary).set({ ...content, updatedAt: sql`(datetime('now'))` }).where(eq(schema.userDictionary.id, old.id))
          }
          else if (!old.translation?.trim()) {
            await tx.update(schema.userDictionary).set({
              translation: content.translation,
              transcription: old.transcription || content.transcription,
              grammarNote: old.grammarNote || content.grammarNote,
              vocabularyNote: old.vocabularyNote || content.vocabularyNote,
              difficulty: old.difficulty || content.difficulty,
              tags: old.tags || content.tags,
            }).where(eq(schema.userDictionary.id, old.id))
          }
        }
        await tx.insert(schema.wordToDeck).values(batch.map(w => ({ wordId: byWord.get(w.word)!.id, deckId: deck.id }))).onConflictDoNothing()
        const contexts = batch.flatMap(w => w.contexts.map(c => ({ userId, wordId: byWord.get(w.word)!.id, bookId: row.bookId, sentence: c.sentence })))
        for (let index = 0; index < contexts.length; index += 50)
          await tx.insert(schema.wordEncounters).values(contexts.slice(index, index + 50)).onConflictDoNothing()
      }
      if (addedWords) {
        await tx.insert(schema.dailyActivity).values({ userId, date: new Date().toISOString().split('T')[0], wordsAdded: addedWords }).onConflictDoUpdate({
          target: [schema.dailyActivity.userId, schema.dailyActivity.date],
          set: { wordsAdded: sql`${schema.dailyActivity.wordsAdded} + ${addedWords}` },
        })
      }
      await tx.update(schema.bookDeckDrafts).set({ deckId: deck.id, name: name.trim() }).where(eq(schema.bookDeckDrafts.id, id))
      return { deckId: deck.id }
    })
  },
}
