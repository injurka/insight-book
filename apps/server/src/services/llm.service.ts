import type { BatchAnalysisRequest, BatchAnalysisResponse, GeneratedWordExamples, LlmAnalysis, LlmConfig, ModelMessage, WordAutoFillResponse } from '../types'
import { eq, inArray, sql } from 'drizzle-orm'
import { pinyin } from 'pinyin-pro'
import { LlmAnalysisSchema } from '~/types/schemas'
import { getVoiceForLanguage, hashSentence, hashTtsText, parseLlmJson } from '~/utils/helpers'
import { callLlmJsonWithRetry } from '~/utils/llm-api'
import { db } from '../db'
import * as schema from '../db/schema'
import {
  BOOK_ANALYSIS_PROMPT,
  getBatchSystemPrompt,
  getDeepDivePrompt,
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
      console.warn(`[LLM] Failed with model [${model}]:`, lastError.message)
    }
  }

  throw new AppError(500, `Не удалось получить валидный ответ от ИИ: ${lastError?.message || 'Unknown error'}`)
}

export async function generateDeepDiveQuiz(userId: number, word: string, language: string, targetLang: string, mode: 'collocations' | 'radicals', config: LlmConfig): Promise<any> {
  await checkTokenLimit(userId)
  if (!config.url)
    throw new AppError(500, 'LLM API не настроен')

  const messages: ModelMessage[] = [
    { role: 'system', content: getDeepDivePrompt(language, targetLang, mode) },
    { role: 'user', content: `Word: ${word}` },
  ]

  const modelsToTry = [config.model, config.fallbackModel].filter(Boolean) as string[]
  let lastError: Error | null = null

  for (const model of modelsToTry) {
    try {
      const { parsed } = await callLlmJsonWithRetry<any>(
        model,
        messages,
        0.4,
        AbortSignal.timeout(60000),
        config,
        raw => parseLlmJson<any>(raw),
        (usage, rawText, messagesUsed) => {
          trackTokenUsage(userId, `deep_dive_${mode}`, model, usage.promptTokens, usage.completionTokens, JSON.stringify(messagesUsed, null, 2), rawText)
        },
      )
      return parsed
    }
    catch (e) {
      lastError = e as Error
      console.warn(`[LLM] Failed with model [${model}]:`, lastError.message)
    }
  }

  throw new AppError(500, `Не удалось получить ответ от ИИ: ${lastError?.message || 'Unknown error'}`)
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
      const { parsed } = await callLlmJsonWithRetry<{ description: any, difficulty: string, tags: string[] }>(
        model,
        messages,
        0.3,
        AbortSignal.timeout(90000),
        config,
        raw => parseLlmJson(raw),
        (usage, rawText, messagesUsed) => {
          trackTokenUsage(userId, 'analyze_book', model, usage.promptTokens, usage.completionTokens, JSON.stringify(messagesUsed, null, 2), rawText)
        },
      )
      return parsed
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
      const { parsed } = await callLlmJsonWithRetry<{ description: string, difficulty: string, tags: string[] }>(
        model,
        messages,
        0.3,
        AbortSignal.timeout(90000),
        config,
        raw => parseLlmJson(raw),
        (usage, rawText, messagesUsed) => {
          trackTokenUsage(userId, 'analyze_manga', model, usage.promptTokens, usage.completionTokens, JSON.stringify(messagesUsed, null, 2), rawText)
        },
      )
      return parsed
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
          const parsedData = parseLlmJson<any>(raw)
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

      const llmCacheInserts: any[] = []
      const newBookCacheInserts: any[] = []

      for (const res of parsedArray) {
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

  const ttsUrl = config.ttsUrl || config.url
  const ttsKey = config.ttsKey || config.key
  const ttsModel = config.ttsModel!

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

  const isGeminiTts = ttsModel.toLowerCase().includes('gemini')

  let finalVoice = voice
  if (isGeminiTts) {
    if (voice === 'alloy')
      finalVoice = 'Kore'
    else if (voice === 'shimmer')
      finalVoice = 'Callirrhoe'
    else if (voice === 'nova')
      finalVoice = 'Orus'
  }

  const response = await fetch(`${ttsUrl}/audio/speech`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: ttsModel,
      input: normalizedText,
      voice: finalVoice,
      response_format: isGeminiTts ? 'wav' : 'mp3',
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

// Алгоритм расстояния Левенштейна для базовой оценки
function calculatePhoneticSimilarity(expected: string, heard: string, language: string): number {
  let s1 = expected.toLowerCase().replace(/[.,!?;:()\s]/g, '')
  let s2 = heard.toLowerCase().replace(/[.,!?;:()\s]/g, '')

  if (language.startsWith('zh')) {
    s1 = pinyin(expected, { toneType: 'num', type: 'array' }).join('')
    s2 = pinyin(heard, { toneType: 'num', type: 'array' }).join('')
  }

  if (s1.length === 0 && s2.length === 0)
    return 100
  if (s1.length === 0 || s2.length === 0)
    return 0

  const matrix = Array.from({ length: s1.length + 1 }, () => Array.from({ length: s2.length + 1 }).fill(0)) as number[][]

  for (let i = 0; i <= s1.length; i++) matrix[i][0] = i
  for (let j = 0; j <= s2.length; j++) matrix[0][j] = j

  for (let i = 1; i <= s1.length; i++) {
    for (let j = 1; j <= s2.length; j++) {
      if (s1[i - 1] === s2[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1]
      }
      else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1,
        )
      }
    }
  }

  const distance = matrix[s1.length][s2.length]
  const maxLength = Math.max(s1.length, s2.length)

  return Math.max(0, Math.round(((maxLength - distance) / maxLength) * 100))
}

export async function checkPronunciationAudio(userId: number, word: string, language: string, targetLang: string, audioFile: File, config: LlmConfig) {
  await checkTokenLimit(userId)

  if (!config.url)
    throw new AppError(500, 'LLM API не настроен')

  let apiUrl = config.sttUrl || config.url
  if (apiUrl.endsWith('/chat/completions')) {
    apiUrl = apiUrl.replace(/\/chat\/completions$/, '/audio/transcriptions')
  }
  else if (apiUrl.endsWith('/v1')) {
    apiUrl = `${apiUrl}/audio/transcriptions`
  }
  else {
    apiUrl = `${apiUrl}/v1/audio/transcriptions`
  }

  const sttModel = config.sttModel!
  const sttKey = config.sttKey || config.key

  const fd = new FormData()
  fd.append('file', audioFile)
  fd.append('model', sttModel)
  fd.append('prompt', 'Transcribe exactly what is spoken phonetically, even if it contains tonal or pronunciation errors. Do not auto-correct.')

  if (language) {
    fd.append('language', language.substring(0, 2))
  }

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: sttKey ? { Authorization: `Bearer ${sttKey}` } : {},
      body: fd,
      signal: AbortSignal.timeout(30000),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`STT API Error: ${response.status} ${errorText}`)
    }

    const data = await response.json() as any
    const heardText = data.text?.trim() || ''

    const textSimilarity = calculatePhoneticSimilarity(word, heardText, language)

    let finalScore = textSimilarity
    let heardPhonetic = ''
    let mistakeAnalysis = ''

    const sttPromptTokens = data.usage?.prompt_tokens || Math.round(audioFile.size / 100)
    const sttCompletionTokens = data.usage?.completion_tokens || heardText.length
    trackTokenUsage(userId, 'check_pronunciation_stt', sttModel, sttPromptTokens, sttCompletionTokens, `[AUDIO ${Math.round(audioFile.size / 1024)}KB]`, heardText)

    if (heardText && textSimilarity < 100) {
      try {
        const messages: ModelMessage[] = [
          {
            role: 'system',
            content: `You are a strict phonetic and linguistic analyzer. The user was supposed to pronounce a word in ${language}.
Analyze the pronunciation mistake phonetically (e.g., Pinyin tones, Romaji, consonants/vowels).
Return ONLY valid JSON.
Output STRICT JSON ONLY. Never use backticks for strings.
{
  "score": <number 0-100, based on phonetic similarity, not just text similarity>,
  "heard_phonetic": "<phonetic transcription (pinyin/romaji/etc) of what they actually said>",
  "mistake_analysis": "<Brief explanation of the mistake in ${targetLang}. e.g., 'You said J instead of ZH', 'Wrong tone'>."
}`,
          },
          { role: 'user', content: `Expected word: ${word}\nHeard by STT: ${heardText}` },
        ]
        const llmModel = config.model!

        // Оборачиваем вызов анализа произношения
        const { parsed } = await callLlmJsonWithRetry<{ score?: number, heard_phonetic?: string, mistake_analysis?: string }>(
          llmModel,
          messages,
          0.2,
          AbortSignal.timeout(15000),
          config,
          raw => parseLlmJson<{ score?: number, heard_phonetic?: string, mistake_analysis?: string }>(raw),
          (usage, rawText, messagesUsed) => {
            trackTokenUsage(userId, 'check_pronunciation_llm', llmModel, usage.promptTokens, usage.completionTokens, JSON.stringify(messagesUsed, null, 2), rawText)
          },
        )

        if (parsed.score !== undefined)
          finalScore = parsed.score
        heardPhonetic = parsed.heard_phonetic || ''
        mistakeAnalysis = parsed.mistake_analysis || ''
      }
      catch (e) {
        console.warn('[Audio Service] Failed to analyze heard text via LLM:', e)
      }
    }
    else if (textSimilarity === 100) {
      mistakeAnalysis = targetLang === 'ru' ? 'Идеальное произношение!' : (targetLang === 'zh' ? '发音完美！' : 'Perfect pronunciation!')
    }

    return {
      heardText,
      score: finalScore,
      heardPhonetic,
      mistakeAnalysis,
    }
  }
  catch (error: unknown) {
    console.error('[Audio Service] Pronunciation Check Failed:', error.message)
    throw new AppError(500, `Ошибка распознавания речи: ${error.message}`)
  }
}
