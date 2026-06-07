import type { GeneratedWordExamples, LlmAnalysis, LlmConfig, WordAutoFillResponse } from '../types'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import {
  LLM_API_KEY,
  LLM_API_URL,
  LLM_FALLBACK_MODEL,
  LLM_MODEL,
  TTS_API_KEY,
  TTS_MODEL,
} from '../config'
import { db } from '../db'
import * as schema from '../db/schema'
import { BOOK_ANALYSIS_PROMPT, getMangaAnalysisPrompt, getSystemPrompt, getWordAutoFillPrompt, getWordExamplesPrompt } from '../prompts'
import { AppError } from '../utils/errors'

export function extractLlmConfig(req: Request): LlmConfig {
  const customUrl = req.headers.get('x-custom-llm-url')
  const customModel = req.headers.get('x-custom-llm-model')

  if (customUrl && customModel) {
    return {
      url: customUrl,
      key: req.headers.get('x-custom-llm-key') || '',
      model: customModel,
    }
  }

  return {
    url: LLM_API_URL,
    key: LLM_API_KEY,
    model: LLM_MODEL,
    fallbackModel: LLM_FALLBACK_MODEL,
  }
}

const GrammarRuleSchema = z.object({
  pattern: z.string().catch(''),
  explanation: z.string().catch(''),
  example: z.string().catch(''),
})
const VocabItemSchema = z.object({
  word: z.string().catch(''),
  transcription: z.string().catch(''),
  meaning: z.string().catch(''),
  usageInContext: z.string().catch(''),
})
const LlmAnalysisSchema = z.object({
  transcription: z.string().catch(''),
  translation: z.string().catch(''),
  grammarRules: z.array(GrammarRuleSchema).default([]),
  vocabulary: z.array(VocabItemSchema).default([]),
})

export function hashSentence(sentence: string, language: string, model: string, targetLang: string): string {
  const hasher = new Bun.CryptoHasher('sha256')
  hasher.update(`${(language || 'en').toLowerCase()}::${(targetLang || 'ru').toLowerCase()}::${model}::${sentence.trim().toLowerCase()}`)

  return hasher.digest('hex')
}

async function _callLlmApi(model: string, messages: any[], temperature: number, signal: AbortSignal, config: LlmConfig) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  if (config.key) {
    headers.Authorization = `Bearer ${config.key}`
  }

  const response = await fetch(`${config.url}/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model,
      response_format: { type: 'json_object' },
      messages,
      temperature,
      max_tokens: 16384
    }),
    signal,
  })

  if (!response.ok)
    throw new Error(`LLM API error ${response.status}: ${await response.text()}`)

  const data = await response.json() as any

  if (data.error)
    throw new Error(`LLM API error from [${model}]: ${data.error.message || JSON.stringify(data.error)}`)

  if (!data.choices || !data.choices[0]?.message?.content)
    throw new Error(`Invalid LLM response from [${model}]: ${JSON.stringify(data)}`)

  return data.choices[0].message.content
}

export async function analyzeSentence(bookId: number, sentence: string, language: string, targetLang: string, config: LlmConfig): Promise<LlmAnalysis> {
  const hash = hashSentence(sentence, language, config.model, targetLang)

  const cached = await db.query.llmCache.findFirst({
    where: eq(schema.llmCache.sentenceHash, hash),
  })

  if (cached) {
    await db.insert(schema.bookLlmCache).values({
      bookId,
      sentenceHash: hash,
    }).onConflictDoNothing()

    return JSON.parse(cached.analysis) as LlmAnalysis
  }

  if (!config.url)
    throw new AppError(500, 'LLM API не настроен')

  const messages = [
    { role: 'system', content: getSystemPrompt(language, targetLang) },
    { role: 'user', content: `Текст: ${sentence}` },
  ]

  const modelsToTry = [config.model, config.fallbackModel].filter(Boolean) as string[]
  let lastError: Error | null = null

  for (const model of modelsToTry) {
    try {
      const raw = await _callLlmApi(model, messages, 0.2, AbortSignal.timeout(60000), config)
      const cleanJson = raw.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim()
      const parsed = JSON.parse(cleanJson)
      const analysis = LlmAnalysisSchema.parse(parsed) as LlmAnalysis

      await db.insert(schema.llmCache).values({
        sentenceHash: hash,
        language,
        sentence,
        analysis: JSON.stringify(analysis),
      }).onConflictDoNothing()

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

export async function generateWordExamples(word: string, language: string, targetLang: string, config: LlmConfig): Promise<GeneratedWordExamples> {
  if (!config.url)
    throw new AppError(500, 'LLM API не настроен')

  const messages = [
    { role: 'system', content: getWordExamplesPrompt(language, targetLang) },
    { role: 'user', content: `Слово: ${word}` },
  ]

  const modelsToTry = [config.model, config.fallbackModel].filter(Boolean) as string[]
  let lastError: Error | null = null

  for (const model of modelsToTry) {
    try {
      const raw = await _callLlmApi(model, messages, 0.4, AbortSignal.timeout(60000), config)
      const cleanJson = raw.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim()
      return JSON.parse(cleanJson) as GeneratedWordExamples
    }
    catch (e) {
      lastError = e as Error
      console.warn(`[LLM] Failed with model [${model}]:`, lastError.message)
    }
  }

  throw new AppError(500, `Не удалось получить валидный ответ от ИИ: ${lastError?.message || 'Unknown error'}`)
}

export async function generateWordAutoFill(word: string, language: string, targetLang: string, config: LlmConfig): Promise<WordAutoFillResponse> {
  if (!config.url)
    throw new AppError(500, 'LLM API не настроен')

  const messages = [
    { role: 'system', content: getWordAutoFillPrompt(language, targetLang) },
    { role: 'user', content: `Слово: ${word}` },
  ]

  const modelsToTry = [config.model, config.fallbackModel].filter(Boolean) as string[]
  let lastError: Error | null = null

  for (const model of modelsToTry) {
    try {
      const raw = await _callLlmApi(model, messages, 0.4, AbortSignal.timeout(60000), config)
      const cleanJson = raw.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim()
      return JSON.parse(cleanJson) as WordAutoFillResponse
    }
    catch (e) {
      lastError = e as Error
      console.warn(`[LLM] Failed with model [${model}]:`, lastError.message)
    }
  }

  throw new AppError(500, `Не удалось получить валидный ответ от ИИ: ${lastError?.message || 'Unknown error'}`)
}

export async function analyzeBookExcerpt(excerpt: string, config: LlmConfig): Promise<{ description: any, difficulty: string, tags: string[] }> {
  if (!config.url)
    throw new AppError(500, 'LLM API не настроен')

  const messages = [
    { role: 'system', content: BOOK_ANALYSIS_PROMPT },
    { role: 'user', content: `Отрывок книги:\n\n${excerpt}` },
  ]

  const modelsToTry = [config.model, config.fallbackModel].filter(Boolean) as string[]
  let lastError: Error | null = null

  for (const model of modelsToTry) {
    try {
      const raw = await _callLlmApi(model, messages, 0.3, AbortSignal.timeout(90000), config)
      const cleanJson = raw.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim()
      return JSON.parse(cleanJson)
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

export async function analyzeMangaInfo(title: string, author: string | null, language: string, config: LlmConfig): Promise<{ description: string, difficulty: string, tags: string[] }> {
  if (!config.url)
    throw new AppError(500, 'LLM API не настроен')

  const promptText = getMangaAnalysisPrompt(language)
  const authorInfo = author ? ` Автор: ${author}` : ''

  const messages = [
    { role: 'system', content: promptText },
    { role: 'user', content: `Название манги/комикса: "${title}".${authorInfo}` },
  ]

  const modelsToTry = [config.model, config.fallbackModel].filter(Boolean) as string[]
  let lastError: Error | null = null

  for (const model of modelsToTry) {
    try {
      const raw = await _callLlmApi(model, messages, 0.3, AbortSignal.timeout(90000), config)
      const cleanJson = raw.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim()
      return JSON.parse(cleanJson)
    }
    catch (e) {
      lastError = e as Error
      console.warn(`[LLM] Failed with model [${model}]:`, lastError.message)
    }
  }

  throw new AppError(500, `Ошибка LLM: ${lastError?.message || 'Неизвестная ошибка'}`)
}

function hashTtsText(text: string, voice: string): string {
  const hasher = new Bun.CryptoHasher('sha256')
  hasher.update(text.trim().toLowerCase() + voice)

  return hasher.digest('hex')
}

function getVoiceForLanguage(language: string): string {
  switch (language.toLowerCase()) {
    case 'en': return 'alloy'
    case 'zh': return 'shimmer'
    case 'ja': return 'nova'
    default: return 'alloy'
  }
}

export async function generateTts(text: string, language: string, config: LlmConfig): Promise<string> {
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

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  if (ttsKey)
    headers.Authorization = `Bearer ${ttsKey}`

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