import type { UserDictItem } from '../types'
import type { IDictionaryRepository } from './interfaces'
import { and, desc, eq, inArray, lte, notInArray, sql } from 'drizzle-orm'
import { createEmptyCard } from 'ts-fsrs'
import { db } from '../db'
import { catalogDb } from '../db/catalog'
import { officialDecks, officialDeckWords } from '../db/catalog-schema'
import * as schema from '../db/schema'

export class DictionaryRepository implements IDictionaryRepository {
  async getUserDecks(userId: number, targetLang: string) {
    return await db.query.dictDecks.findMany({
      where: and(eq(schema.dictDecks.userId, userId), eq(schema.dictDecks.targetLanguage, targetLang)),
    })
  }

  async getDeck(deckId: number, userId: number) {
    return await db.query.dictDecks.findFirst({
      where: and(eq(schema.dictDecks.id, deckId), eq(schema.dictDecks.userId, userId)),
    })
  }

  async getDefaultDeck(userId: number, language: string, targetLang: string) {
    return await db.query.dictDecks.findFirst({
      where: and(
        eq(schema.dictDecks.userId, userId),
        eq(schema.dictDecks.language, language),
        eq(schema.dictDecks.targetLanguage, targetLang),
      ),
    })
  }

  async createDeck(userId: number, name: string, language: string, targetLang: string) {
    const [newDeck] = await db.insert(schema.dictDecks).values({
      userId,
      name,
      language,
      targetLanguage: targetLang,
    }).returning()
    return newDeck
  }

  async updateDeck(deckId: number, userId: number, name: string) {
    return await db.update(schema.dictDecks)
      .set({ name })
      .where(and(eq(schema.dictDecks.id, deckId), eq(schema.dictDecks.userId, userId)))
      .returning({ id: schema.dictDecks.id })
  }

  async deleteDeck(deckId: number, userId: number) {
    return await db.delete(schema.dictDecks)
      .where(and(eq(schema.dictDecks.id, deckId), eq(schema.dictDecks.userId, userId)))
      .returning({ id: schema.dictDecks.id })
  }

  async getWordsInDeck(deckId: number) {
    return await db.select({ id: schema.wordToDeck.wordId })
      .from(schema.wordToDeck)
      .where(eq(schema.wordToDeck.deckId, deckId))
  }

  async deleteWords(wordIds: number[]) {
    if (wordIds.length > 0) {
      await db.delete(schema.userDictionary).where(inArray(schema.userDictionary.id, wordIds))
    }
  }

  async getWordsWithOtherLinks(wordIds: number[], deckId: number) {
    if (wordIds.length === 0)
      return []
    return await db.selectDistinct({ id: schema.wordToDeck.wordId })
      .from(schema.wordToDeck)
      .where(and(
        inArray(schema.wordToDeck.wordId, wordIds),
        sql`${schema.wordToDeck.deckId} != ${deckId}`,
      ))
  }

  async getUserDictionary(userId: number, targetLang: string) {
    const words = await db.query.userDictionary.findMany({
      where: and(eq(schema.userDictionary.userId, userId), eq(schema.userDictionary.targetLanguage, targetLang)),
      with: {
        wordToDecks: true,
        encounters: {
          with: { book: { columns: { title: true } } },
        },
      },
      orderBy: [desc(schema.userDictionary.updatedAt)],
    })

    return words.map(w => ({
      ...w,
      deckIds: w.wordToDecks.map((wd: { deckId: number }) => wd.deckId),
    })) as unknown as UserDictItem[]
  }

  async getWordFromUserDictionary(word: string, userId: number, targetLang: string) {
    const item = await db.query.userDictionary.findFirst({
      where: and(
        eq(schema.userDictionary.word, word),
        eq(schema.userDictionary.userId, userId),
        eq(schema.userDictionary.targetLanguage, targetLang),
      ),
      with: {
        wordToDecks: true,
        encounters: {
          with: { book: { columns: { title: true } } },
        },
      },
    })
    if (!item)
      return null

    return {
      ...item,
      deckIds: item.wordToDecks.map((wd: { deckId: number }) => wd.deckId),
    } as unknown as UserDictItem
  }

  async getWordById(wordId: number, userId: number) {
    return await db.query.userDictionary.findFirst({
      where: and(eq(schema.userDictionary.id, wordId), eq(schema.userDictionary.userId, userId)),
    })
  }

  async upsertWordToDictionary(data: {
    userId: number
    word: string
    transcription?: string | null
    translation?: string | null
    language: string
    targetLanguage: string
    notes?: string | null
    tags?: string | null
    difficulty?: string | null
    grammarNote?: string | null
    vocabularyNote?: string | null
    deckIds: number[]
  }) {
    const emptyCard = createEmptyCard()

    const [upserted] = await db.insert(schema.userDictionary).values({
      userId: data.userId,
      word: data.word,
      transcription: data.transcription,
      translation: data.translation,
      language: data.language,
      targetLanguage: data.targetLanguage,
      notes: data.notes,
      tags: data.tags,
      difficulty: data.difficulty,
      grammarNote: data.grammarNote,
      vocabularyNote: data.vocabularyNote,

      state: emptyCard.state,
      due: emptyCard.due.toISOString(),
      stability: emptyCard.stability,
      difficultyFsrs: emptyCard.difficulty,
      scheduledDays: emptyCard.scheduled_days,
      reps: emptyCard.reps,
      lapses: emptyCard.lapses,
      lastReview: null,
      learningSteps: emptyCard.learning_steps ?? 0,

      updatedAt: new Date().toISOString(),
    }).onConflictDoUpdate({
      target: [schema.userDictionary.userId, schema.userDictionary.word, schema.userDictionary.targetLanguage],
      set: {
        transcription: data.transcription,
        translation: data.translation,
        notes: data.notes,
        tags: data.tags,
        difficulty: data.difficulty,
        grammarNote: data.grammarNote,
        vocabularyNote: data.vocabularyNote,
        updatedAt: new Date().toISOString(),
      },
    }).returning({ id: schema.userDictionary.id })

    if (upserted) {
      await db.delete(schema.wordToDeck).where(eq(schema.wordToDeck.wordId, upserted.id))
      if (data.deckIds.length > 0) {
        const links = data.deckIds.map(did => ({
          wordId: upserted.id,
          deckId: did,
        }))
        await db.insert(schema.wordToDeck).values(links)
      }
    }
    return upserted
  }

  async upsertWordEncounter(userId: number, wordId: number, contextSentence: string, contextBookId?: number) {
    await db.insert(schema.wordEncounters).values({
      userId,
      wordId,
      bookId: contextBookId || null,
      sentence: contextSentence,
    }).onConflictDoNothing()
  }

  async removeFromUserDictionary(word: string, userId: number, targetLang: string) {
    await db.delete(schema.userDictionary).where(and(
      eq(schema.userDictionary.word, word),
      eq(schema.userDictionary.userId, userId),
      eq(schema.userDictionary.targetLanguage, targetLang),
    ))
  }

  async getReviewQueue(
    userId: number,
    language: string | undefined,
    targetLang: string,
    mode: 'srs' | 'random' | 'deep_dive' | 'cram' = 'srs',
    deckId?: number | 'none',
    difficulty?: string,
  ) {
    const filters: import("drizzle-orm").SQL[] = [
      eq(schema.userDictionary.userId, userId),
      eq(schema.userDictionary.targetLanguage, targetLang),
    ]

    if (language && language !== 'all') {
      filters.push(eq(schema.userDictionary.language, language))
    }

    if (deckId === 'none') {
      filters.push(notInArray(schema.userDictionary.id, db.select({ id: schema.wordToDeck.wordId }).from(schema.wordToDeck)))
    }
    else if (deckId !== undefined) {
      filters.push(inArray(schema.userDictionary.id, db.select({ id: schema.wordToDeck.wordId }).from(schema.wordToDeck).where(eq(schema.wordToDeck.deckId, deckId))))
    }

    if (difficulty && difficulty !== 'all') {
      if (difficulty === 'none') {
        filters.push(sql`${schema.userDictionary.difficulty} IS NULL OR ${schema.userDictionary.difficulty} = ''`)
      }
      else {
        filters.push(eq(schema.userDictionary.difficulty, difficulty))
      }
    }

    if (mode === 'srs') {
      const now = new Date().toISOString()
      filters.push(lte(schema.userDictionary.due, now))

      return await db.query.userDictionary.findMany({
        where: and(...filters),
        with: { encounters: true },
        orderBy: [schema.userDictionary.due],
        limit: 50,
      })
    }
    else {
      return await db.query.userDictionary.findMany({
        where: and(...filters),
        with: { encounters: true },
        orderBy: [sql`RANDOM()`],
        limit: mode === 'cram' ? 500 : 50,
      })
    }
  }

  async updateWordSrs(wordId: number, data: Partial<typeof import("../db/schema").userDictionary.$inferInsert>) {
    await db.update(schema.userDictionary).set(data).where(eq(schema.userDictionary.id, wordId))
  }

  async bulkDeleteWords(userId: number, wordIds: number[]) {
    await db.delete(schema.userDictionary).where(and(
      inArray(schema.userDictionary.id, wordIds),
      eq(schema.userDictionary.userId, userId),
    ))
  }

  async bulkMoveWords(wordIds: number[], deckIds?: number[]) {
    await db.delete(schema.wordToDeck).where(inArray(schema.wordToDeck.wordId, wordIds))

    if (deckIds && deckIds.length > 0) {
      const links = []
      for (const wordId of wordIds) {
        for (const deckId of deckIds) {
          links.push({ wordId, deckId })
        }
      }
      await db.insert(schema.wordToDeck).values(links).onConflictDoNothing()
    }
  }

  async getCatalogDecks() {
    return await catalogDb.select().from(officialDecks)
  }

  async getCatalogWords(deckId: number) {
    return await catalogDb.select().from(officialDeckWords).where(eq(officialDeckWords.deckId, deckId))
  }

  async getCatalogDeckById(deckId: number) {
    return await catalogDb.select().from(officialDecks).where(eq(officialDecks.id, deckId)).get()
  }

  async upsertClonedWords(userWords: (typeof import("../db/schema").userDictionary.$inferInsert)[]) {
    return await db.insert(schema.userDictionary).values(userWords).onConflictDoUpdate({
      target: [schema.userDictionary.userId, schema.userDictionary.word, schema.userDictionary.targetLanguage],
      set: {
        transcription: sql`excluded.transcription`,
        translation: sql`excluded.translation`,
        grammarNote: sql`excluded.grammarNote`,
        vocabularyNote: sql`excluded.vocabularyNote`,
        updatedAt: new Date().toISOString(),
      },
    }).returning({ id: schema.userDictionary.id })
  }

  async linkWordsToDeck(links: (typeof import("../db/schema").wordToDeck.$inferInsert)[]) {
    await db.insert(schema.wordToDeck).values(links).onConflictDoNothing()
  }

  async getCustomPrompts(userId: number) {
    return await db.select().from(schema.customPrompts).where(eq(schema.customPrompts.userId, userId))
  }

  async getCustomPromptById(id: number, userId: number) {
    const [dbPrompt] = await db
      .select()
      .from(schema.customPrompts)
      .where(and(eq(schema.customPrompts.id, id), eq(schema.customPrompts.userId, userId)))
    return dbPrompt
  }

  async createCustomPrompt(userId: number, name: string, prompt: string) {
    const [newPrompt] = await db
      .insert(schema.customPrompts)
      .values({ userId, name, prompt })
      .returning()
    return newPrompt
  }

  async updateCustomPrompt(id: number, userId: number, updateData: Partial<typeof import("../db/schema").customPrompts.$inferInsert>) {
    const [updatedPrompt] = await db
      .update(schema.customPrompts)
      .set({ ...updateData, updatedAt: sql`(datetime('now'))` })
      .where(and(eq(schema.customPrompts.id, id), eq(schema.customPrompts.userId, userId)))
      .returning()
    return updatedPrompt
  }

  async deleteCustomPrompt(id: number, userId: number) {
    const [deletedPrompt] = await db
      .delete(schema.customPrompts)
      .where(and(eq(schema.customPrompts.id, id), eq(schema.customPrompts.userId, userId)))
      .returning()
    return deletedPrompt
  }
}

export const dictionaryRepository = new DictionaryRepository()
