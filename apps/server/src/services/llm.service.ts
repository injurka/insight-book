import type { BatchAnalysisRequest, BatchAnalysisResponse, GeneratedWordExamples, LlmAnalysis, LlmConfig, ModelMessage, WordAutoFillResponse } from '../types'
import { eq, inArray, sql } from 'drizzle-orm'
import { LlmAnalysisSchema } from '~/types/schemas'
import { getVoiceForLanguage, hashSentence, hashTtsText, parseLlmJson } from '~/utils/helpers'
import { callLlmApi } from '~/utils/llm-api'
import {
  LLM_API_KEY,
  LLM_API_URL,
  LLM_MODEL,
  TTS_API_KEY,
  TTS_MODEL,
} from '../config'
import { db } from '../db'
import * as schema from '../db/schema'
import {
  BOOK_ANALYSIS_PROMPT,
  getBatchSystemPrompt,
  getMangaAnalysisPrompt,
  getSystemPrompt,
  getWordAutoFillPrompt,
  getWordExamplesPrompt,
} from '../prompts'
import { AppError } from '../utils/errors'
import { checkTokenLimit } from './limits.service'
import { trackTokenUsage } from './token.service'

function isOldFormatAnalysis(parsed: any): boolean {
  if (!parsed || typeof parsed !== 'object')
    return true
  if (Array.isArray(parsed.grammarRules)) {
    if (parsed.grammarRules.some((r: any) => typeof r !== 'object' || r === null))
      return true
  }
  if (Array.isArray(parsed.vocabulary)) {
    if (parsed.vocabulary.some((v: any) => typeof v !== 'object' || v === null))
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
      const { text: raw, usage } = await callLlmApi(model, messages, 0.2, AbortSignal.timeout(60000), config)
      trackTokenUsage(userId, 'analyze_sentence', model, usage.promptTokens, usage.completionTokens, JSON.stringify(messages, null, 2), raw)

      const parsed = parseLlmJson(raw)
      const analysis = LlmAnalysisSchema.parse(parsed) as LlmAnalysis

      await db.insert(schema.llmCache).values({
        sentenceHash: hash,
        language,
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
      }).onConflictDoNothing()

      return analysis
    }
    catch (e) {
      lastError = e as Error
      console.warn(`[LLM] Failed with model [${model}]:`, lastError.message)
    }
  }

  throw new AppError(500, `Не удалось получить валидный ответ от ИИ: ${lastError?.message || 'Unknown error'}`)
}

export async function checkCacheBatch(bookId: number, sentences: string[], language: string, targetLang: string) {
  if (!sentences.length)
    return []

  const uniqueSentences = Array.from(new Set(sentences))
  const hashes = uniqueSentences.map(s => hashSentence(s, language, targetLang))

  const cachedDocs = await db.query.llmCache.findMany({
    where: inArray(schema.llmCache.sentenceHash, hashes),
  })

  const results: { sentence: string, analysis: any }[] = []
  const bookCacheInserts: { bookId: number, sentenceHash: string }[] = []

  const cacheMap = new Map(cachedDocs.map(d => [d.sentenceHash, d.analysis]))

  for (const sentence of uniqueSentences) {
    const hash = hashSentence(sentence, language, targetLang)
    const cachedAnalysisStr = cacheMap.get(hash)
    if (cachedAnalysisStr) {
      try {
        const parsed = JSON.parse(cachedAnalysisStr)
        if (!isOldFormatAnalysis(parsed)) {
          bookCacheInserts.push({ bookId, sentenceHash: hash })
          results.push({ sentence, analysis: parsed })
        }
      }
      catch (e) { }
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
      const { text: raw, usage } = await callLlmApi(model, messages, 0.4, AbortSignal.timeout(60000), config)
      trackTokenUsage(userId, 'dict_examples', model, usage.promptTokens, usage.completionTokens, JSON.stringify(messages, null, 2), raw)

      return parseLlmJson<GeneratedWordExamples>(raw)
    }
    catch (e) {
      lastError = e as Error
      console.warn(`[LLM] Failed with model [${model}]:`, lastError.message)
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
      const { text: raw, usage } = await callLlmApi(model, messages, 0.4, AbortSignal.timeout(60000), config)
      trackTokenUsage(userId, 'dict_autofill', model, usage.promptTokens, usage.completionTokens, JSON.stringify(messages, null, 2), raw)

      return parseLlmJson<WordAutoFillResponse>(raw)
    }
    catch (e) {
      lastError = e as Error
      console.warn(`[LLM] Failed with model [${model}]:`, lastError.message)
    }
  }

  throw new AppError(500, `Не удалось получить валидный ответ от ИИ: ${lastError?.message || 'Unknown error'}`)
}

export async function analyzeBookExcerpt(userId: number, excerpt: string, config: LlmConfig): Promise<{ description: any, difficulty: string, tags: string[] }> {
  await checkTokenLimit(userId)

  if (!config.url)
    throw new AppError(500, 'LLM API не настроен')

  const messages: ModelMessage[] = [
    { role: 'system', content: BOOK_ANALYSIS_PROMPT },
    { role: 'user', content: `Отрывок книги:\n\n${excerpt}` },
  ]

  const modelsToTry = [config.model, config.fallbackModel].filter(Boolean) as string[]
  let lastError: Error | null = null

  for (const model of modelsToTry) {
    try {
      const { text: raw, usage } = await callLlmApi(model, messages, 0.3, AbortSignal.timeout(90000), config)
      trackTokenUsage(userId, 'analyze_book', model, usage.promptTokens, usage.completionTokens, JSON.stringify(messages, null, 2), raw)

      return parseLlmJson(raw)
    }
    catch (e) {
      lastError = e as Error
      console.warn(`[LLM] Failed with model [${model}]:`, lastError.message)
    }
  }

  if (lastError?.message.includes('No candidates returned') || lastError?.message.includes('safety')) {
    console.warn('[LLM] Текст заблокирован фильтрами безопасности ИИ на всех моделях. Возвращаем заглушку.')
    return {
      description: 'Краткое описание недоступно. Текст книги был заблокирован внутренними фильтрами безопасности ИИ (вероятно, из-за описания драматических или трагических событий).',
      difficulty: 'Неизвестно',
      tags: ['драма', 'требует проверки'],
    }
  }

  throw new AppError(500, `Ошибка LLM: ${lastError?.message || 'Неизвестная ошибка'}`)
}

export async function analyzeMangaInfo(userId: number, title: string, author: string | null, language: string, config: LlmConfig): Promise<{ description: string, difficulty: string, tags: string[] }> {
  await checkTokenLimit(userId)

  if (!config.url)
    throw new AppError(500, 'LLM API не настроен')

  const promptText = getMangaAnalysisPrompt(language)
  const authorInfo = author ? ` Автор: ${author}` : ''

  const messages: ModelMessage[] = [
    { role: 'system', content: promptText },
    { role: 'user', content: `Название манги/комикса: "${title}".${authorInfo}` },
  ]

  const modelsToTry = [config.model, config.fallbackModel].filter(Boolean) as string[]
  let lastError: Error | null = null

  for (const model of modelsToTry) {
    try {
      const { text: raw, usage } = await callLlmApi(model, messages, 0.3, AbortSignal.timeout(90000), config)
      trackTokenUsage(userId, 'analyze_manga', model, usage.promptTokens, usage.completionTokens, JSON.stringify(messages, null, 2), raw)

      return parseLlmJson(raw)
    }
    catch (e) {
      lastError = e as Error
      console.warn(`[LLM] Failed with model [${model}]:`, lastError.message)
    }
  }

  throw new AppError(500, `Ошибка LLM: ${lastError?.message || 'Неизвестная ошибка'}`)
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
  const bookCacheInserts: { bookId: number, sentenceHash: string }[] = []

  for (const item of itemHashes) {
    const cachedAnalysisStr = cacheMap.get(item.hash)
    if (cachedAnalysisStr) {
      try {
        const parsed = JSON.parse(cachedAnalysisStr)
        if (!isOldFormatAnalysis(parsed)) {
          bookCacheInserts.push({ bookId, sentenceHash: item.hash })
          results.push({ id: item.id, analysis: parsed })
          continue
        }
      }
      catch (e) { }
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
      const { text: raw, usage } = await callLlmApi(model, messages, 0.2, AbortSignal.timeout(90000), config)
      trackTokenUsage(userId, 'analyze_batch', model, usage.promptTokens, usage.completionTokens, JSON.stringify(messages, null, 2), raw)

      const parsedData = parseLlmJson<any>(raw)

      const parsedArray = Array.isArray(parsedData)
        ? parsedData
        : (parsedData.results || parsedData.items || parsedData.analysis || [])

      if (!Array.isArray(parsedArray)) {
        throw new TypeError('Ожидался массив, но ИИ вернул не поддерживаемый формат')
      }

      const llmCacheInserts: any[] = []
      const newBookCacheInserts: any[] = []

      for (const res of parsedArray as BatchAnalysisResponse[]) {
        const originalItem = missingItems.find(m => m.id === res.id)
        if (originalItem) {
          const hash = hashSentence(originalItem.sentence, language, targetLang)

          llmCacheInserts.push({
            sentenceHash: hash,
            language,
            sentence: originalItem.sentence,
            analysis: JSON.stringify(res.analysis),
          })
          newBookCacheInserts.push({ bookId, sentenceHash: hash })
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
      console.warn(`[LLM Batch] Failed with model [${model}]:`, e)
    }
  }

  return results
}

export async function generateTts(userId: number, text: string, language: string, config: LlmConfig): Promise<string> {
  const normalizedText = text.trim()
  const voice = getVoiceForLanguage(language)

  if (!normalizedText)
    throw new AppError(400, 'Текст не передан')

  const ttsUrl = config.url === LLM_API_URL ? LLM_API_URL : config.url
  const ttsKey = config.key === LLM_API_KEY && TTS_API_KEY ? TTS_API_KEY : config.key
  const ttsModel = config.model === LLM_MODEL && TTS_MODEL ? TTS_MODEL : 'tts-1'

  if (!ttsUrl)
    throw new AppError(500, 'TTS API не настроен')

  const hash = hashTtsText(normalizedText, voice)

  const cached = await db.query.ttsCache.findFirst({
    where: eq(schema.ttsCache.textHash, hash),
  })

  if (cached)
    return cached.audioBase64

  await checkTokenLimit(userId)

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  if (ttsKey)
    headers.Authorization = `Bearer ${ttsKey}`

  trackTokenUsage(userId, 'tts_generation', ttsModel, normalizedText.length, 0, normalizedText, '[AUDIO BASE64]')

  const response = await fetch(`${ttsUrl}/audio/speech`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: ttsModel,
      input: normalizedText,
      voice,
      response_format: 'mp3',
    }),
    signal: AbortSignal.timeout(60000),
  })

  if (!response.ok)
    throw new AppError(500, `TTS API error ${response.status}: ${await response.text()}`)

  const arrayBuffer = await response.arrayBuffer()
  const base64 = Buffer.from(arrayBuffer).toString('base64')

  await db.insert(schema.ttsCache).values({
    textHash: hash,
    text: normalizedText,
    audioBase64: base64,
  }).onConflictDoUpdate({
    target: schema.ttsCache.textHash,
    set: {
      text: normalizedText,
      audioBase64: base64,
    },
  })

  return base64
}
