import type { BatchAnalysisRequest, BatchAnalysisResponse, GeneratedWordExamples, LlmAnalysis, LlmConfig, ModelMessage, WordAutoFillResponse } from '../types'
import { eq, inArray, sql } from 'drizzle-orm'
import { LlmAnalysisSchema } from '~/types/schemas'
import { hashSentence, parseLlmJson } from '~/utils/helpers'
import { callLlmJsonWithRetry } from '~/utils/llm-api'
import { db } from '../db'
import * as schema from '../db/schema'
import { getBatchSystemPrompt, getSystemPrompt, getWordAutoFillPrompt, getWordExamplesPrompt } from '../prompts'
import { AppError } from '../utils/errors'
import { logger } from '../utils/logger'
import { checkTokenLimit } from './limits.service'
import { trackTokenUsage } from './token.service'

function isOldFormatAnalysis(parsed: unknown): boolean {
  if (!parsed || typeof parsed !== 'object')
    return true
  const p = parsed as Record<string, unknown>
  if (Array.isArray(p.grammarRules)) {
    if (p.grammarRules.some((r: unknown) => typeof r !== 'object' || r === null))
      return true
  }
  if (Array.isArray(p.vocabulary)) {
    if (p.vocabulary.some((v: unknown) => typeof v !== 'object' || v === null))
      return true
  }
  return false
}

export async function analyzeSentence(
  userId: number,
  bookId: number,
  sentence: string,
  language: string,
  targetLang: string,
  config: LlmConfig,
  context?: string,
  type: 'sentence' | 'word' = 'sentence',
): Promise<LlmAnalysis> {
  await checkTokenLimit(userId)

  const hash = hashSentence(sentence, language, targetLang)

  const cached = await db.query.llmCache.findFirst({
    where: eq(schema.llmCache.sentenceHash, hash),
  })

  if (cached) {
    try {
      const parsed = JSON.parse(cached.analysis)
      if (!isOldFormatAnalysis(parsed)) {
        await db.insert(schema.bookLlmCache).values({
          bookId,
          sentenceHash: hash,
          type,
        }).onConflictDoNothing()

        return parsed as LlmAnalysis
      }
    }
    catch { }
  }

  if (!config.url)
    throw new AppError(500, 'LLM API не настроен')

  const messages: ModelMessage[] = [
    { role: 'system', content: getSystemPrompt(language, targetLang) },
    { role: 'user', content: `Текст: ${sentence}${context ? `\nКонтекст: ${context}` : ''}` },
  ]

  const modelsToTry = [config.model, config.fallbackModel].filter(Boolean) as string[]
  let lastError: Error | null = null

  for (const model of modelsToTry) {
    try {
      const { parsed: analysis } = await callLlmJsonWithRetry<LlmAnalysis>(
        model,
        messages,
        0.2,
        AbortSignal.timeout(60000),
        config,
        raw => LlmAnalysisSchema.parse(parseLlmJson(raw)) as LlmAnalysis,
        (usage, rawText, messagesUsed) => {
          trackTokenUsage(userId, 'analyze_sentence', model, usage.promptTokens, usage.completionTokens, JSON.stringify(messagesUsed, null, 2), rawText)
        },
      )

      await db.insert(schema.llmCache).values({
        sentenceHash: hash,
        language,
        targetLanguage: targetLang,
        sentence,
        analysis: JSON.stringify(analysis),
      }).onConflictDoUpdate({
        target: schema.llmCache.sentenceHash,
        set: {
          analysis: JSON.stringify(analysis),
        },
      })

      await db.insert(schema.bookLlmCache).values({
        bookId,
        sentenceHash: hash,
        type,
      }).onConflictDoNothing()

      return analysis
    }
    catch (e) {
      lastError = e as Error
      logger.warn({ err: lastError }, `[LLM] Failed with model [${model}]:`)
    }
  }

  throw new AppError(500, `Не удалось получить валидный ответ от ИИ: ${lastError?.message || 'Unknown error'}`)
}

export async function checkCacheBatch(bookId: number, items: { text: string, type: 'sentence' | 'word' }[], language: string, targetLang: string) {
  if (!items.length)
    return []

  const uniqueTexts = Array.from(new Set(items.map(i => i.text)))
  const hashes = uniqueTexts.map(s => hashSentence(s, language, targetLang))

  const cachedDocs = await db.query.llmCache.findMany({
    where: inArray(schema.llmCache.sentenceHash, hashes),
  })

  const results: { sentence: string, analysis: LlmAnalysis }[] = []
  const bookCacheInserts: { bookId: number, sentenceHash: string, type: 'sentence' | 'word' }[] = []

  const cacheMap = new Map(cachedDocs.map(d => [d.sentenceHash, d.analysis]))

  for (const item of items) {
    const hash = hashSentence(item.text, language, targetLang)
    const cachedAnalysisStr = cacheMap.get(hash)
    if (cachedAnalysisStr) {
      try {
        const parsed = JSON.parse(cachedAnalysisStr)
        if (!isOldFormatAnalysis(parsed)) {
          bookCacheInserts.push({ bookId, sentenceHash: hash, type: item.type })
          results.push({ sentence: item.text, analysis: parsed })
        }
      }
      catch { }
    }
  }

  if (bookCacheInserts.length > 0) {
    await db.insert(schema.bookLlmCache).values(bookCacheInserts).onConflictDoNothing()
  }

  return results
}

export async function generateWordExamples(userId: number, word: string, language: string, targetLang: string, config: LlmConfig): Promise<GeneratedWordExamples> {
  await checkTokenLimit(userId)

  if (!config.url)
    throw new AppError(500, 'LLM API не настроен')

  const messages: ModelMessage[] = [
    { role: 'system', content: getWordExamplesPrompt(language, targetLang) },
    { role: 'user', content: `Слово: ${word}` },
  ]

  const modelsToTry = [config.model, config.fallbackModel].filter(Boolean) as string[]
  let lastError: Error | null = null

  for (const model of modelsToTry) {
    try {
      const { parsed } = await callLlmJsonWithRetry<GeneratedWordExamples>(
        model,
        messages,
        0.4,
        AbortSignal.timeout(60000),
        config,
        raw => parseLlmJson<GeneratedWordExamples>(raw),
        (usage, rawText, messagesUsed) => {
          trackTokenUsage(userId, 'dict_examples', model, usage.promptTokens, usage.completionTokens, JSON.stringify(messagesUsed, null, 2), rawText)
        },
      )
      return parsed
    }
    catch (e) {
      lastError = e as Error
      logger.warn({ err: lastError }, `[LLM] Failed with model [${model}]:`)
    }
  }

  throw new AppError(500, `Не удалось получить валидный ответ от ИИ: ${lastError?.message || 'Unknown error'}`)
}

export async function generateWordAutoFill(userId: number, word: string, language: string, targetLang: string, config: LlmConfig): Promise<WordAutoFillResponse> {
  await checkTokenLimit(userId)

  if (!config.url)
    throw new AppError(500, 'LLM API не настроен')

  const messages: ModelMessage[] = [
    { role: 'system', content: getWordAutoFillPrompt(language, targetLang) },
    { role: 'user', content: `Слово: ${word}` },
  ]

  const modelsToTry = [config.model, config.fallbackModel].filter(Boolean) as string[]
  let lastError: Error | null = null

  for (const model of modelsToTry) {
    try {
      const { parsed } = await callLlmJsonWithRetry<WordAutoFillResponse>(
        model,
        messages,
        0.4,
        AbortSignal.timeout(60000),
        config,
        raw => parseLlmJson<WordAutoFillResponse>(raw),
        (usage, rawText, messagesUsed) => {
          trackTokenUsage(userId, 'dict_autofill', model, usage.promptTokens, usage.completionTokens, JSON.stringify(messagesUsed, null, 2), rawText)
        },
      )
      return parsed
    }
    catch (e) {
      lastError = e as Error
      logger.warn({ err: lastError }, `[LLM] Failed with model [${model}]:`)
    }
  }

  throw new AppError(500, `Не удалось получить валидный ответ от ИИ: ${lastError?.message || 'Unknown error'}`)
}

export async function analyzeBatch(userId: number, bookId: number, items: BatchAnalysisRequest[], language: string, targetLang: string, config: LlmConfig): Promise<BatchAnalysisResponse[]> {
  const results: BatchAnalysisResponse[] = []
  const missingItems: BatchAnalysisRequest[] = []

  const itemHashes = items.map(item => ({
    ...item,
    hash: hashSentence(item.sentence, language, targetLang),
  }))

  const hashesToFind = itemHashes.map(i => i.hash)

  const cachedDocs = hashesToFind.length > 0
    ? await db.query.llmCache.findMany({
        where: inArray(schema.llmCache.sentenceHash, hashesToFind),
      })
    : []

  const cacheMap = new Map(cachedDocs.map(d => [d.sentenceHash, d.analysis]))
  const bookCacheInserts: { bookId: number, sentenceHash: string, type: 'sentence' | 'word' }[] = []

  for (const item of itemHashes) {
    const cachedAnalysisStr = cacheMap.get(item.hash)
    if (cachedAnalysisStr) {
      try {
        const parsed = JSON.parse(cachedAnalysisStr)
        if (!isOldFormatAnalysis(parsed)) {
          bookCacheInserts.push({ bookId, sentenceHash: item.hash, type: item.type || 'sentence' })
          results.push({ id: item.id, analysis: parsed })
          continue
        }
      }
      catch { }
    }
    missingItems.push(item)
  }

  if (bookCacheInserts.length > 0) {
    await db.insert(schema.bookLlmCache).values(bookCacheInserts).onConflictDoNothing()
  }

  if (missingItems.length === 0)
    return results

  await checkTokenLimit(userId)

  const payload = missingItems.map(m => ({ id: m.id, text: m.sentence, context: m.context }))
  const messages: ModelMessage[] = [
    { role: 'system', content: getBatchSystemPrompt(language, targetLang) },
    { role: 'user', content: JSON.stringify(payload) },
  ]

  const modelsToTry = [config.model, config.fallbackModel].filter(Boolean) as string[]
  for (const model of modelsToTry) {
    try {
      const { parsed: parsedArray } = await callLlmJsonWithRetry<BatchAnalysisResponse[]>(
        model,
        messages,
        0.2,
        AbortSignal.timeout(90000),
        config,
        (raw) => {
          const parsedData = parseLlmJson<Record<string, unknown>>(raw)
          const arr = Array.isArray(parsedData)
            ? parsedData
            : (parsedData.results || parsedData.items || parsedData.analysis || [])
          if (!Array.isArray(arr)) {
            throw new TypeError('Ожидался массив, но ИИ вернул не поддерживаемый формат')
          }
          return arr as BatchAnalysisResponse[]
        },
        (usage, rawText, messagesUsed) => {
          trackTokenUsage(userId, 'analyze_batch', model, usage.promptTokens, usage.completionTokens, JSON.stringify(messagesUsed, null, 2), rawText)
        },
      )

      const llmCacheInserts: { sentenceHash: string, language: string, targetLanguage: string, sentence: string, analysis: string }[] = []
      const newBookCacheInserts: { bookId: number, sentenceHash: string, type: 'sentence' | 'word' }[] = []

      for (const res of parsedArray) {
        const originalItem = missingItems.find(m => m.id === res.id)
        if (originalItem) {
          const hash = hashSentence(originalItem.sentence, language, targetLang)

          llmCacheInserts.push({
            sentenceHash: hash,
            language,
            targetLanguage: targetLang,
            sentence: originalItem.sentence,
            analysis: JSON.stringify(res.analysis),
          })
          newBookCacheInserts.push({ bookId, sentenceHash: hash, type: originalItem.type || 'sentence' })
        }
        results.push(res)
      }

      if (llmCacheInserts.length > 0) {
        await db.insert(schema.llmCache).values(llmCacheInserts).onConflictDoUpdate({
          target: schema.llmCache.sentenceHash,
          set: { analysis: sql`excluded.analysis` },
        })
        await db.insert(schema.bookLlmCache).values(newBookCacheInserts).onConflictDoNothing()
      }

      return results
    }
    catch (e) {
      logger.warn(e, `[LLM Batch] Failed with model [${model}]:`)
    }
  }

  return results
}
