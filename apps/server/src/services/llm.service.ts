import type { LlmAnalysis } from '../types'
import { z } from 'zod'
import { LLM_API_KEY, LLM_API_URL, LLM_FALLBACK_MODEL, LLM_MODEL, TTS_API_KEY, TTS_MODEL } from '../config'
import { sqlite } from '../db'
import { BOOK_ANALYSIS_PROMPT, getSystemPrompt } from '../prompts'
import { AppError } from '../utils/errors'

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

function hashSentence(sentence: string, language: string): string {
  const hasher = new Bun.CryptoHasher('sha256')
  hasher.update(`${language.toLowerCase()}::${sentence.trim()}`)
  return hasher.digest('hex')
}

async function _callLlmApi(model: string, messages: any[], temperature: number, signal: AbortSignal) {
  const response = await fetch(`${LLM_API_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${LLM_API_KEY}`,
    },
    body: JSON.stringify({
      model,
      response_format: { type: 'json_object' },
      messages,
      temperature,
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

export async function analyzeSentence(bookId: number, sentence: string, language: string): Promise<LlmAnalysis> {
  const hash = hashSentence(sentence, language)

  // 1. Проверяем наличие в глобальном кэше
  const cached = sqlite.prepare(`SELECT analysis FROM llm_cache WHERE sentenceHash = ?`).get(hash) as { analysis: string } | null

  if (cached) {
    // 2. Если нашли в кэше, связываем с текущей книгой (INSERT OR IGNORE)
    sqlite.prepare(`
      INSERT OR IGNORE INTO book_llm_cache (bookId, sentenceHash) 
      VALUES (?, ?)
    `).run(bookId, hash)

    return JSON.parse(cached.analysis) as LlmAnalysis
  }

  if (!LLM_API_KEY)
    throw new AppError(500, 'LLM_API_KEY не настроен')

  const messages = [
    { role: 'system', content: getSystemPrompt(language) },
    { role: 'user', content: `Текст: ${sentence}` },
  ]

  const modelsToTry = [LLM_MODEL, LLM_FALLBACK_MODEL].filter(Boolean)
  let lastError: Error | null = null

  for (const model of modelsToTry) {
    try {
      const raw = await _callLlmApi(model, messages, 0.2, AbortSignal.timeout(30000))
      const cleanJson = raw.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim()
      const parsed = JSON.parse(cleanJson)
      const analysis = LlmAnalysisSchema.parse(parsed) as LlmAnalysis

      // 3. Сохраняем в глобальный кэш
      sqlite.prepare(`
        INSERT OR IGNORE INTO llm_cache (sentenceHash, language, sentence, analysis) 
        VALUES (?, ?, ?, ?)
      `).run(hash, language, sentence, JSON.stringify(analysis))

      // 4. Связываем предложение с книгой, в которой его перевели
      sqlite.prepare(`
        INSERT OR IGNORE INTO book_llm_cache (bookId, sentenceHash) 
        VALUES (?, ?)
      `).run(bookId, hash)

      return analysis
    }
    catch (e) {
      lastError = e as Error
      console.warn(`[LLM] Failed with model [${model}]:`, lastError.message)
    }
  }

  throw new AppError(500, `Не удалось получить валидный ответ от ИИ: ${lastError?.message || 'Unknown error'}`)
}

export async function analyzeBookExcerpt(excerpt: string): Promise<{ description: string, difficulty: string, tags: string[] }> {
  if (!LLM_API_KEY)
    throw new AppError(500, 'LLM_API_KEY не настроен')

  const messages = [
    { role: 'system', content: BOOK_ANALYSIS_PROMPT },
    { role: 'user', content: `Отрывок книги:\n\n${excerpt}` },
  ]

  const modelsToTry = [LLM_MODEL, LLM_FALLBACK_MODEL].filter(Boolean)
  let lastError: Error | null = null

  for (const model of modelsToTry) {
    try {
      const raw = await _callLlmApi(model, messages, 0.3, AbortSignal.timeout(45000))
      const cleanJson = raw.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim()
      return JSON.parse(cleanJson)
    }
    catch (e) {
      lastError = e as Error
      console.warn(`[LLM] Failed with model [${model}]:`, lastError.message)
    }
  }

  if (lastError?.message.includes('No candidates returned')) {
    console.warn('[LLM] Текст заблокирован фильтрами безопасности ИИ на всех моделях. Возвращаем заглушку.')
    return {
      description: 'Краткое описание недоступно. Текст книги был заблокирован внутренними фильтрами безопасности ИИ (вероятно, из-за описания драматических или трагических событий).',
      difficulty: 'Неизвестно',
      tags: ['драма', 'требует проверки'],
    }
  }

  throw new AppError(500, `Ошибка LLM: ${lastError?.message || 'Неизвестная ошибка'}`)
}

function hashTtsText(text: string, voice: string): string {
  const hasher = new Bun.CryptoHasher('sha256')
  hasher.update(text.trim() + voice)
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

export async function generateTts(text: string, language: string): Promise<string> {
  const normalizedText = text.trim()
  const voice = getVoiceForLanguage(language)

  if (!normalizedText)
    throw new AppError(400, 'Текст не передан')

  if (!TTS_API_KEY)
    throw new AppError(500, 'TTS_API_KEY не настроен')

  const hash = hashTtsText(normalizedText, voice)
  const cached = sqlite.prepare(`SELECT audioBase64 FROM tts_cache WHERE textHash = ?`).get(hash) as { audioBase64: string } | null

  if (cached)
    return cached.audioBase64

  const response = await fetch(`${LLM_API_URL}/audio/speech`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${TTS_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: TTS_MODEL,
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

  sqlite.prepare(`
    INSERT OR REPLACE INTO tts_cache (textHash, text, audioBase64)
    VALUES (?, ?, ?)
  `).run(hash, normalizedText, base64)

  return base64
}
