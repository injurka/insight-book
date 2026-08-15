import type { IDictionaryRepository } from '../repositories/interfaces'
import type { LlmConfig, PageDictEntry, UserDictItem } from '../types'
import { createEmptyCard, FSRS, Rating } from 'ts-fsrs'
import { ERROR_CODES } from '../constants/error-codes'
import { db } from '../db'
import { getDictionaryChatPrompt } from '../prompts'
import { dictionaryRepository } from '../repositories/dictionary.repository'
import { AppError } from '../utils/errors'
import { normalizeLanguageCode } from '../utils/helpers'
import { callLlmApi } from '../utils/llm-api'
import { logger } from '../utils/logger'
import { activityService } from './activity.service'
import { generateWordAutoFill } from './llm.service'
import { trackTokenUsage } from './token.service'

export class DictionaryService {
  constructor(private dictRepo: IDictionaryRepository = dictionaryRepository) { }
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

    return dict
  }

  async lookupSingleWord(word: string, language: string, targetLang: string, userId: number): Promise<PageDictEntry | null> {
    const userWord = await this.dictRepo.getWordFromUserDictionary(word, userId, targetLang)
    if (userWord) {
      return { transcription: userWord.transcription || '', translation: userWord.translation || '', isUserDict: true }
    }
    return null
  }

  async getUserDecks(userId: number, targetLang: string) {
    return await this.dictRepo.getUserDecks(userId, targetLang)
  }

  async createDeck(userId: number, name: string, language: string, targetLang: string) {
    return await this.dictRepo.createDeck(userId, name, language, targetLang)
  }

  async updateDeck(deckId: number, userId: number, name: string) {
    const res = await this.dictRepo.updateDeck(deckId, userId, name)
    if (res.length === 0)
      throw new AppError(404, ERROR_CODES.DICTIONARY.DECK_NOT_FOUND, 'Deck not found')
  }

  async deleteDeck(deckId: number, userId: number, mode: 'keep' | 'delete_all' | 'delete_exclusive' = 'keep') {
    const deck = await this.dictRepo.getDeck(deckId, userId)
    if (!deck)
      throw new AppError(404, ERROR_CODES.DICTIONARY.DECK_NOT_FOUND, 'Deck not found')

    if (mode === 'delete_all') {
      const wordsInDeck = await this.dictRepo.getWordsInDeck(deckId)
      await this.dictRepo.deleteWords(wordsInDeck.map(w => w.id))
    }
    else if (mode === 'delete_exclusive') {
      const wordsInDeck = await this.dictRepo.getWordsInDeck(deckId)
      const wordIds = wordsInDeck.map(w => w.id)
      const wordsWithOtherLinks = await this.dictRepo.getWordsWithOtherLinks(wordIds, deckId)
      const otherLinksSet = new Set(wordsWithOtherLinks.map(w => w.id))
      const wordsToDelete = wordIds.filter(id => !otherLinksSet.has(id))
      await this.dictRepo.deleteWords(wordsToDelete)
    }

    const res = await this.dictRepo.deleteDeck(deckId, userId)
    if (res.length === 0)
      throw new AppError(404, ERROR_CODES.DICTIONARY.DECK_NOT_FOUND, 'Deck not found')
  }

  async getUserDictionary(userId: number, targetLang: string) {
    return await this.dictRepo.getUserDictionary(userId, targetLang)
  }

  async getWordFromUserDictionary(word: string, userId: number, targetLang: string) {
    const entry = await this.dictRepo.getWordFromUserDictionary(word, userId, targetLang)
    if (!entry)
      throw new AppError(404, ERROR_CODES.DICTIONARY.WORD_NOT_FOUND, 'Word not found in user dictionary')
    return entry
  }

  async upsertToUserDictionary(item: Partial<UserDictItem> & { contextSentence?: string, contextBookId?: number }, userId: number, targetLang: string) {
    if (item.language === targetLang)
      return

    let deckIds = item.deckIds || []
    if (deckIds.length === 0) {
      let defaultDeck = await this.dictRepo.getDefaultDeck(userId, item.language || 'en', targetLang)
      if (!defaultDeck) {
        const deckName = targetLang === 'ru' ? 'Основная колода' : (targetLang === 'zh' ? '默认词库' : 'Main deck')
        defaultDeck = await this.dictRepo.createDeck(userId, deckName, item.language || 'en', targetLang)
      }
      deckIds = [defaultDeck.id]
    }

    const upserted = await this.dictRepo.upsertWordToDictionary({
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
      await this.dictRepo.upsertWordEncounter(userId, upserted.id, item.contextSentence, item.contextBookId)
    }

    await activityService.trackActivity(userId, 'wordsAdded', 1)
  }

  async removeFromUserDictionary(word: string, userId: number, targetLang: string) {
    await this.dictRepo.removeFromUserDictionary(word, userId, targetLang)
  }

  async getReviewQueue(userId: number, language: string | undefined, targetLang: string, mode: 'srs' | 'random' | 'deep_dive' | 'cram' = 'srs', deckId?: number | 'none' | (number | 'none')[], difficulty?: string) {
    return await this.dictRepo.getReviewQueue(userId, language, targetLang, mode, deckId, difficulty)
  }

  async processSrsReview(wordId: number, userId: number, grade: number) {
    const word = await this.dictRepo.getWordById(wordId, userId)
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

    await this.dictRepo.updateWordSrs(wordId, {
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
    await this.dictRepo.bulkDeleteWords(userId, wordIds)
  }

  async bulkMoveDict(userId: number, wordIds: number[], deckIds?: number[]) {
    await this.dictRepo.bulkMoveWords(userId, wordIds, deckIds)
  }

  async getCatalogDecks() {
    const decks = await this.dictRepo.getCatalogDecks()
    return decks.map(d => ({ ...d, name: d.title }))
  }

  async getCatalogWords(deckId: number) {
    return await this.dictRepo.getCatalogWords(deckId)
  }

  async cloneCatalogDeck(userId: number, deckId: number, targetLang: string) {
    const deckToClone = await this.dictRepo.getCatalogDeckById(deckId)
    if (!deckToClone)
      throw new AppError(404, ERROR_CODES.DICTIONARY.DECK_NOT_FOUND, 'Deck not found')

    const wordsToClone = await this.dictRepo.getCatalogWords(deckId)
    const newDeck = await this.dictRepo.createDeck(userId, deckToClone.title, deckToClone.language, targetLang)

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

      const upserted = await this.dictRepo.upsertClonedWords(userWords)
      if (upserted.length > 0) {
        const links = upserted.map(u => ({ wordId: u.id, deckId: newDeck.id }))
        await this.dictRepo.linkWordsToDeck(links)
      }
      await activityService.trackActivity(userId, 'wordsAdded', userWords.length)
    }
    return newDeck.id
  }

  async dictionaryChat(userId: number, word: string, language: string, uiLanguage: string, customPromptId?: number, userPromptText?: string, config?: LlmConfig) {
    let systemPrompt = getDictionaryChatPrompt(uiLanguage)
    if (customPromptId) {
      const dbPrompt = await this.dictRepo.getCustomPromptById(customPromptId, userId)
      if (!dbPrompt)
        throw new AppError(404, ERROR_CODES.DICTIONARY.PROMPT_NOT_FOUND, 'Custom prompt not found')
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
        logger.error({ word, err: e }, 'Failed to background autofill word:')
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
        logger.error(e, 'Background autofill loop crashed:')
      })
    }
  }

  async getCustomPrompts(userId: number) {
    return await this.dictRepo.getCustomPrompts(userId)
  }

  async createCustomPrompt(userId: number, name: string, prompt: string) {
    return await this.dictRepo.createCustomPrompt(userId, name, prompt)
  }

  async updateCustomPrompt(id: number, userId: number, updateData: { name?: string, prompt?: string }) {
    const prompt = await this.dictRepo.updateCustomPrompt(id, userId, updateData)
    if (!prompt)
      throw new AppError(404, ERROR_CODES.DICTIONARY.PROMPT_NOT_FOUND, 'Custom prompt not found')
    return prompt
  }

  async deleteCustomPrompt(id: number, userId: number) {
    const prompt = await this.dictRepo.deleteCustomPrompt(id, userId)
    if (!prompt)
      throw new AppError(404, ERROR_CODES.DICTIONARY.PROMPT_NOT_FOUND, 'Custom prompt not found')
  }
}

export const dictionaryService = new DictionaryService()
