import type { LlmConfig, PageDictEntry, UserDictItem } from '../types'
import { inArray } from 'drizzle-orm'
import { sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { createEmptyCard, FSRS, Rating } from 'ts-fsrs'
import { db, getDictConnection } from '../db'
import { getDictionaryChatPrompt } from '../prompts'
import { dictionaryRepository } from '../repositories/dictionary.repository'
import { AppError } from '../utils/errors'
import { normalizeLanguageCode } from '../utils/helpers'
import { callLlmApi } from '../utils/llm-api'
import { activityService } from './activity.service'
import { generateWordAutoFill } from './llm.service'
import { trackTokenUsage } from './token.service'

export class DictionaryService {
  async lookupWords(words: string[], language: string, targetLang: string, userId: number): Promise<Record<string, PageDictEntry>> {
    if (!words.length)
      return {}
    const dict: Record<string, PageDictEntry> = {}
    const chunkSize = 500

    for (let i = 0; i < words.length; i += chunkSize) {
      const chunk = words.slice(i, i + chunkSize)
      // For this specific complex query, we keep it simple or move to repo.
      // It's already in the repo technically, but let's just use db directly here to save time or implement it.
      const userRows = await db.query.userDictionary.findMany({
        where: (users, { and, inArray, eq }) => and(
          inArray(users.word, chunk),
          eq(users.userId, userId),
          eq(users.targetLanguage, targetLang),
        ),
        columns: { word: true, transcription: true, translation: true },
      })

      for (const row of userRows) {
        if (!row.word)
          continue
        const entry = { transcription: row.transcription || '', translation: row.translation || '', isUserDict: true }
        dict[row.word] = entry
        dict[row.word.toLowerCase()] = entry
      }
    }

    const conn = getDictConnection(language, targetLang)
    if (conn) {
      const schemaObj = {
        [conn.wordCol]: text(conn.wordCol).notNull(),
        [conn.translationCol]: text(conn.translationCol),
        ...(conn.hasTranscription ? { [conn.transcriptionCol]: text(conn.transcriptionCol) } : {}),
      }
      const dictTable = sqliteTable(conn.tableName, schemaObj)

      for (let i = 0; i < words.length; i += chunkSize) {
        const chunk = words.slice(i, i + chunkSize)
        const missingWords = chunk.filter(w => !dict[w] && !dict[w.toLowerCase()])
        if (!missingWords.length)
          continue

        try {
          const selection = {
            word: dictTable[conn.wordCol],
            translation: dictTable[conn.translationCol],
            ...(conn.hasTranscription ? { transcription: dictTable[conn.transcriptionCol] } : {}),
          }
          const searchWords = Array.from(new Set(missingWords.flatMap(w => [w, w.toLowerCase()])))

          const rows = await conn.dDb.select(selection).from(dictTable).where(inArray(dictTable[conn.wordCol], searchWords))
          for (const row of rows) {
            if (!row.word)
              continue
            const entry = {
              transcription: (conn.hasTranscription ? row.transcription : '') || '',
              translation: row.translation || '',
              isUserDict: false,
            }
            dict[row.word as string] = entry
            dict[(row.word as string).toLowerCase()] = entry
          }
        }
        catch (e) {
          console.error(`[Dictionary Error] Failed to query ${conn.tableName}:`, e)
        }
      }
    }
    return dict
  }

  async lookupSingleWord(word: string, language: string, targetLang: string, userId: number): Promise<PageDictEntry | null> {
    const userWord = await dictionaryRepository.getWordFromUserDictionary(word, userId, targetLang)
    if (userWord) {
      return { transcription: userWord.transcription || '', translation: userWord.translation || '', isUserDict: true }
    }
    const conn = getDictConnection(language, targetLang)
    if (!conn)
      return null

    const schemaObj = {
      [conn.wordCol]: text(conn.wordCol).notNull(),
      [conn.translationCol]: text(conn.translationCol),
      ...(conn.hasTranscription ? { [conn.transcriptionCol]: text(conn.transcriptionCol) } : {}),
    }
    const dictTable = sqliteTable(conn.tableName, schemaObj)

    try {
      const selection = {
        word: dictTable[conn.wordCol],
        translation: dictTable[conn.translationCol],
        ...(conn.hasTranscription ? { transcription: dictTable[conn.transcriptionCol] } : {}),
      }
      const searchWords = Array.from(new Set([word, word.toLowerCase()]))
      const rows = await conn.dDb.select(selection).from(dictTable).where(inArray(dictTable[conn.wordCol], searchWords)).limit(1)

      if (rows.length > 0) {
        return {
          transcription: (conn.hasTranscription ? rows[0].transcription : '') || '',
          translation: rows[0].translation || '',
          isUserDict: false,
        }
      }
    }
    catch (e) {
      console.error(`[Dictionary Error] Failed to lookup single word:`, e)
    }
    return null
  }

  async getUserDecks(userId: number, targetLang: string) {
    return await dictionaryRepository.getUserDecks(userId, targetLang)
  }

  async createDeck(userId: number, name: string, language: string, targetLang: string) {
    return await dictionaryRepository.createDeck(userId, name, language, targetLang)
  }

  async updateDeck(deckId: number, userId: number, name: string) {
    const res = await dictionaryRepository.updateDeck(deckId, userId, name)
    if (res.length === 0)
      throw new AppError(404, 'Колода не найдена')
  }

  async deleteDeck(deckId: number, userId: number, mode: 'keep' | 'delete_all' | 'delete_exclusive' = 'keep') {
    const deck = await dictionaryRepository.getDeck(deckId, userId)
    if (!deck)
      throw new AppError(404, 'Колода не найдена')

    if (mode === 'delete_all') {
      const wordsInDeck = await dictionaryRepository.getWordsInDeck(deckId)
      await dictionaryRepository.deleteWords(wordsInDeck.map(w => w.id))
    }
    else if (mode === 'delete_exclusive') {
      const wordsInDeck = await dictionaryRepository.getWordsInDeck(deckId)
      const wordIds = wordsInDeck.map(w => w.id)
      const wordsWithOtherLinks = await dictionaryRepository.getWordsWithOtherLinks(wordIds, deckId)
      const otherLinksSet = new Set(wordsWithOtherLinks.map(w => w.id))
      const wordsToDelete = wordIds.filter(id => !otherLinksSet.has(id))
      await dictionaryRepository.deleteWords(wordsToDelete)
    }

    const res = await dictionaryRepository.deleteDeck(deckId, userId)
    if (res.length === 0)
      throw new AppError(404, 'Колода не найдена')
  }

  async getUserDictionary(userId: number, targetLang: string) {
    return await dictionaryRepository.getUserDictionary(userId, targetLang)
  }

  async getWordFromUserDictionary(word: string, userId: number, targetLang: string) {
    const entry = await dictionaryRepository.getWordFromUserDictionary(word, userId, targetLang)
    if (!entry)
      throw new AppError(404, 'Слово не найдено в словаре пользователя')
    return entry
  }

  async upsertToUserDictionary(item: Partial<UserDictItem> & { contextSentence?: string, contextBookId?: number }, userId: number, targetLang: string) {
    if (item.language === targetLang)
      return

    let deckIds = item.deckIds || []
    if (deckIds.length === 0) {
      let defaultDeck = await dictionaryRepository.getDefaultDeck(userId, item.language || 'en', targetLang)
      if (!defaultDeck) {
        const deckName = targetLang === 'ru' ? 'Основная колода' : (targetLang === 'zh' ? '默认词库' : 'Main deck')
        defaultDeck = await dictionaryRepository.createDeck(userId, deckName, item.language || 'en', targetLang)
      }
      deckIds = [defaultDeck.id]
    }

    const upserted = await dictionaryRepository.upsertWordToDictionary({
      userId,
      word: item.word!,
      transcription: item.transcription,
      translation: item.translation,
      language: item.language || 'en',
      targetLanguage: targetLang,
      notes: item.notes,
      tags: item.tags,
      difficulty: item.difficulty,
      grammarNote: item.grammarNote,
      vocabularyNote: item.vocabularyNote,
      deckIds,
    })

    if (item.contextSentence) {
      await dictionaryRepository.upsertWordEncounter(userId, upserted.id, item.contextSentence, item.contextBookId)
    }

    await activityService.trackActivity(userId, 'wordsAdded', 1)
  }

  async removeFromUserDictionary(word: string, userId: number, targetLang: string) {
    await dictionaryRepository.removeFromUserDictionary(word, userId, targetLang)
  }

  async getReviewQueue(userId: number, language: string | undefined, targetLang: string, mode: 'srs' | 'random' | 'deep_dive' | 'cram' = 'srs', deckId?: number | 'none', difficulty?: string) {
    return await dictionaryRepository.getReviewQueue(userId, language, targetLang, mode, deckId, difficulty)
  }

  async processSrsReview(wordId: number, userId: number, grade: number) {
    const word = await dictionaryRepository.getWordById(wordId, userId)
    if (!word)
      throw new Error('Word not found')

    const fsrs = new FSRS({})
    const card = createEmptyCard()
    card.due = new Date(word.due)
    card.stability = word.stability
    card.difficulty = word.difficultyFsrs
    card.scheduled_days = word.scheduledDays
    card.reps = word.reps
    card.lapses = word.lapses
    card.state = word.state
    card.last_review = word.lastReview ? new Date(word.lastReview) : undefined
    card.learning_steps = word.learningSteps ?? 0

    const now = new Date()
    const schedulingCards = fsrs.repeat(card, now)
    let recordLog
    switch (grade) {
      case Rating.Again:
        recordLog = schedulingCards[Rating.Again]
        break
      case Rating.Hard:
        recordLog = schedulingCards[Rating.Hard]
        break
      case Rating.Good:
        recordLog = schedulingCards[Rating.Good]
        break
      case Rating.Easy:
        recordLog = schedulingCards[Rating.Easy]
        break
      default: throw new Error('Invalid grade rating')
    }

    await dictionaryRepository.updateWordSrs(wordId, {
      due: recordLog.card.due.toISOString(),
      stability: recordLog.card.stability,
      difficultyFsrs: recordLog.card.difficulty,
      scheduledDays: recordLog.card.scheduled_days,
      reps: recordLog.card.reps,
      lapses: recordLog.card.lapses,
      state: recordLog.card.state,
      lastReview: recordLog.card.last_review?.toISOString() || null,
      learningSteps: recordLog.card.learning_steps ?? 0,
      updatedAt: new Date().toISOString(),
    })

    await activityService.trackActivity(userId, 'wordsReviewed', 1)
  }

  async bulkDeleteDict(userId: number, wordIds: number[]) {
    await dictionaryRepository.bulkDeleteWords(userId, wordIds)
  }

  async bulkMoveDict(wordIds: number[], deckIds?: number[]) {
    await dictionaryRepository.bulkMoveWords(wordIds, deckIds)
  }

  async getCatalogDecks() {
    const decks = await dictionaryRepository.getCatalogDecks()
    return decks.map(d => ({ ...d, name: d.title }))
  }

  async getCatalogWords(deckId: number) {
    return await dictionaryRepository.getCatalogWords(deckId)
  }

  async cloneCatalogDeck(userId: number, deckId: number, targetLang: string) {
    const deckToClone = await dictionaryRepository.getCatalogDeckById(deckId)
    if (!deckToClone)
      throw new AppError(404, 'Deck not found')

    const wordsToClone = await dictionaryRepository.getCatalogWords(deckId)
    const newDeck = await dictionaryRepository.createDeck(userId, deckToClone.title, deckToClone.language, targetLang)

    if (wordsToClone.length > 0) {
      const emptyCard = createEmptyCard()
      const userWords = wordsToClone.map(w => ({
        userId,
        word: w.word,
        transcription: w.transcription,
        translation: w.translation,
        difficulty: w.difficulty,
        tags: w.tags,
        language: deckToClone.language,
        targetLanguage: targetLang,
        grammarNote: w.grammarNote,
        vocabularyNote: w.vocabularyNote,
        state: emptyCard.state,
        due: emptyCard.due.toISOString(),
        stability: emptyCard.stability,
        difficultyFsrs: emptyCard.difficulty,
        scheduledDays: emptyCard.scheduled_days,
        reps: emptyCard.reps,
        lapses: emptyCard.lapses,
        lastReview: null,
        updatedAt: new Date().toISOString(),
      }))

      const upserted = await dictionaryRepository.upsertClonedWords(userWords)
      if (upserted.length > 0) {
        const links = upserted.map(u => ({ wordId: u.id, deckId: newDeck.id }))
        await dictionaryRepository.linkWordsToDeck(links)
      }
      await activityService.trackActivity(userId, 'wordsReviewed', userWords.length)
    }
    return newDeck.id
  }

  async dictionaryChat(userId: number, word: string, language: string, uiLanguage: string, customPromptId?: number, userPromptText?: string, config?: LlmConfig) {
    let systemPrompt = getDictionaryChatPrompt(uiLanguage)
    if (customPromptId) {
      const dbPrompt = await dictionaryRepository.getCustomPromptById(customPromptId, userId)
      if (!dbPrompt)
        throw new AppError(404, 'Custom prompt not found')
      systemPrompt += `\n\nAdditional Instructions:\n${dbPrompt.prompt}`
    }

    let userContent = `Word: ${word}\nLanguage: ${language}`
    if (userPromptText)
      userContent += `\nQuestion: ${userPromptText}`

    const modelName = config?.model || config?.fallbackModel || 'gpt-4o'
    const messages = [{ role: 'system' as const, content: systemPrompt }, { role: 'user' as const, content: userContent }]
    const result = await callLlmApi(modelName, messages, 0.3, AbortSignal.timeout(60000), config || {} as LlmConfig)

    trackTokenUsage(userId, 'chat_ai', modelName, result.usage.promptTokens, result.usage.completionTokens, JSON.stringify(messages), result.text)
    return result.text
  }

  async processAutofillInBackground(userId: number, targetDeckId: number | undefined, targetLang: string, wordsToFill: string[], language: string | undefined, config: LlmConfig) {
    for (const word of wordsToFill) {
      try {
        const result = await generateWordAutoFill(userId, word, normalizeLanguageCode(language || 'en'), targetLang, config)
        if (result) {
          await this.upsertToUserDictionary({
            word,
            translation: result.translation || '',
            transcription: result.transcription || '',
            language: normalizeLanguageCode(language || 'en'),
            deckIds: targetDeckId ? [targetDeckId] : [],
          }, userId, targetLang)
        }
      }
      catch (e) {
        console.error('Failed to background autofill word:', word, e)
      }
    }
  }

  async importCsv(userId: number, rows: Record<string, string>[], mapping: Record<string, string>, targetLang: string, language?: string, deckId?: number, newDeckName?: string, autoFill?: boolean, config?: LlmConfig) {
    let targetDeckId = deckId
    if (newDeckName) {
      const newDeck = await this.createDeck(userId, newDeckName, normalizeLanguageCode(language || 'en'), targetLang)
      targetDeckId = newDeck.id
    }

    const wordsToFill: string[] = []
    for (const row of rows) {
      const word = row[mapping.word]
      if (!word)
        continue

      const translation = mapping.translation ? row[mapping.translation] : ''
      const transcription = mapping.transcription ? row[mapping.transcription] : ''
      const tags = mapping.tags ? row[mapping.tags] : ''

      await this.upsertToUserDictionary({
        word,
        translation,
        transcription,
        tags,
        deckIds: targetDeckId ? [targetDeckId] : [],
        language: normalizeLanguageCode(language || 'en'),
      }, userId, targetLang)

      if (autoFill && !translation) {
        wordsToFill.push(word)
      }
    }

    if (wordsToFill.length > 0) {
      this.processAutofillInBackground(userId, targetDeckId, targetLang, wordsToFill, language, config || {} as LlmConfig).catch((e) => {
        console.error('Background autofill loop crashed:', e)
      })
    }
  }

  async getCustomPrompts(userId: number) {
    return await dictionaryRepository.getCustomPrompts(userId)
  }

  async createCustomPrompt(userId: number, name: string, prompt: string) {
    return await dictionaryRepository.createCustomPrompt(userId, name, prompt)
  }

  async updateCustomPrompt(id: number, userId: number, updateData: { name?: string, prompt?: string }) {
    const prompt = await dictionaryRepository.updateCustomPrompt(id, userId, updateData)
    if (!prompt)
      throw new AppError(404, 'Custom prompt not found')
    return prompt
  }

  async deleteCustomPrompt(id: number, userId: number) {
    const prompt = await dictionaryRepository.deleteCustomPrompt(id, userId)
    if (!prompt)
      throw new AppError(404, 'Custom prompt not found')
  }
}

export const dictionaryService = new DictionaryService()
