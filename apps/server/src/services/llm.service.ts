import type { BatchAnalysisRequest, BatchAnalysisResponse, GeneratedWordExamples, LlmAnalysis, LlmConfig, ModelMessage, WordAutoFillResponse } from '../types'
import { eq, inArray, sql } from 'drizzle-orm'
import { pinyin } from 'pinyin-pro'
import { LlmAnalysisSchema } from '~/types/schemas'
import { hashSentence, hashTtsText, mapVoiceToOpenAi, parseLlmJson } from '~/utils/helpers'
import { callLlmJsonWithRetry } from '~/utils/llm-api'
import { db } from '../db'
import * as schema from '../db/schema'
import {
  BOOK_ANALYSIS_PROMPT,
  getBatchSystemPrompt,
  getDeepDivePrompt,
  getLangName,
  getMangaAnalysisPrompt,
  getQuizGenerationPrompt,
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
      console.warn(`[LLM] Failed with model [${model}]:`, lastError.message)
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

  const results: { sentence: string, analysis: any }[] = []
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
      console.warn(`[LLM Batch] Failed with model [${model}]:`, e)
    }
  }

  return results
}

export async function generateTts(
  userId: number,
  bookId: number | null,
  text: string,
  config: LlmConfig,
  selectedVoice?: string,
  forceCacheBypass?: boolean,
): Promise<string> {
  const normalizedText = text.trim()

  if (!normalizedText)
    throw new AppError(400, 'Текст не передан')

  const hasChineseChars = /[\u4E00-\u9FA5]/.test(normalizedText)
  const maxLength = hasChineseChars ? 80 : 250

  if (normalizedText.length > maxLength) {
    throw new AppError(400, 'Текст слишком длинный (максимум ~15 секунд звучания)')
  }

  const ttsUrl = config.ttsUrl || config.url
  const ttsKey = config.ttsKey || config.key
  const primaryModel = config.ttsModel!
  const fallbackModel = config.fallbackTtsModel || 'gemini-2.5-flash-preview-tts'

  if (!ttsUrl)
    throw new AppError(500, 'TTS API не настроен')

  const voice = selectedVoice || 'Kore'
  const hash = hashTtsText(normalizedText, voice)

  const cached = await db.query.ttsCache.findFirst({
    where: eq(schema.ttsCache.textHash, hash),
  })

  if (cached && !forceCacheBypass) {
    if (bookId) {
      await db.insert(schema.bookTtsCache).values({ bookId, textHash: hash }).onConflictDoNothing()
    }
    return cached.audioBase64
  }

  await checkTokenLimit(userId)

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  if (ttsKey)
    headers.Authorization = `Bearer ${ttsKey}`

  let textToRead = normalizedText
  if (!/[.!?。！？]$/.test(textToRead)) {
    textToRead += '.'
  }

  async function tryGenerate(model: string, voiceName: string, isGemini: boolean) {
    const requestBody = {
      model,
      input: textToRead,
      voice: voiceName,
      response_format: isGemini ? 'wav' : 'mp3',
    }

    const response = await fetch(`${ttsUrl}/audio/speech`, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(60000),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new AppError(500, `TTS API error ${response.status}: ${errorText}`)
    }

    const arrayBuffer = await response.arrayBuffer()

    if (arrayBuffer.byteLength === 0) {
      throw new AppError(500, 'TTS API returned empty audio data')
    }

    return Buffer.from(arrayBuffer).toString('base64')
  }

  let base64 = ''
  const isPrimaryGemini = primaryModel.toLowerCase().includes('gemini')
  let usedModel = primaryModel

  try {
    base64 = await tryGenerate(primaryModel, voice, isPrimaryGemini)
  }
  catch (error: unknown) {
    if ((error as Error).name === 'AbortError')
      throw error

    console.warn(`[TTS] Primary model (${primaryModel}) failed for text: "${normalizedText.substring(0, 20)}". Error: ${(error as Error).message}`)

    if (fallbackModel && fallbackModel !== primaryModel) {
      // eslint-disable-next-line no-console
      console.log(`[TTS] Trying fallback model (${fallbackModel})...`)
      const isFallbackGemini = fallbackModel.toLowerCase().includes('gemini')
      const fallbackVoice = isFallbackGemini ? voice : mapVoiceToOpenAi(voice)

      try {
        base64 = await tryGenerate(fallbackModel, fallbackVoice, isFallbackGemini)
        usedModel = fallbackModel
      }
      catch (fallbackError: unknown) {
        if ((fallbackError as Error).name === 'AbortError')
          throw fallbackError
        console.error(`[TTS] Fallback model (${fallbackModel}) also failed.`)
        throw fallbackError
      }
    }
    else {
      throw error
    }
  }

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

  if (bookId) {
    await db.insert(schema.bookTtsCache).values({ bookId, textHash: hash }).onConflictDoNothing()
  }

  trackTokenUsage(userId, 'tts_generation', usedModel, normalizedText.length, 0, normalizedText, '[AUDIO BASE64]')

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

  const getErrorMsg = (type: 'not_configured' | 'recognition_failed', detail?: string) => {
    if (type === 'not_configured') {
      if (targetLang === 'ru')
        return 'LLM API не настроен'
      if (targetLang === 'zh')
        return 'LLM API 未配置'
      return 'LLM API is not configured'
    }
    else {
      const suffix = detail ? `: ${detail}` : ''
      if (targetLang === 'ru')
        return `Ошибка распознавания речи${suffix}`
      if (targetLang === 'zh')
        return `语音识别错误${suffix}`
      return `Speech recognition error${suffix}`
    }
  }

  if (!config.url)
    throw new AppError(500, getErrorMsg('not_configured'))

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
  const fallbackSttModel = config.fallbackSttModel
  const sttKey = config.sttKey || config.key

  const doSttRequest = async (model: string) => {
    const fd = new FormData()
    fd.append('file', audioFile)
    fd.append('model', model)
    fd.append('prompt', 'Transcribe exactly what is spoken phonetically, even if it contains tonal or pronunciation errors. Do not auto-correct.')

    if (language) {
      fd.append('language', language.substring(0, 2))
    }

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

    return response.json() as Promise<any>
  }

  try {
    let data: any
    let usedSttModel = sttModel

    try {
      data = await doSttRequest(sttModel)
    }
    catch (primaryErr: unknown) {
      if (fallbackSttModel && fallbackSttModel !== sttModel) {
        console.warn(`[STT] Primary model (${sttModel}) failed, trying fallback (${fallbackSttModel})...`)
        data = await doSttRequest(fallbackSttModel)
        usedSttModel = fallbackSttModel
      }
      else {
        throw primaryErr
      }
    }

    const heardText = data.text?.trim() || ''

    const textSimilarity = calculatePhoneticSimilarity(word, heardText, language)

    let finalScore = textSimilarity
    let heardPhonetic = ''
    let mistakeAnalysis = ''

    const sttPromptTokens = data.usage?.prompt_tokens || Math.round(audioFile.size / 100)
    const sttCompletionTokens = data.usage?.completion_tokens || heardText.length
    trackTokenUsage(userId, 'check_pronunciation_stt', usedSttModel, sttPromptTokens, sttCompletionTokens, `[AUDIO ${Math.round(audioFile.size / 1024)}KB]`, heardText)

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
  catch (err: unknown) {
    if (!(err instanceof Error))
      return
    if (err.name === 'AbortError')
      return

    console.error('[Audio Service] Pronunciation Check Failed:', err.message)
    throw new AppError(500, getErrorMsg('recognition_failed', err.message))
  }
}

/**
 * Вспомогательная функция для пересборки кнопок (слов) из правильного ответа.
 * Автоматически исключает несовпадения в артиклях/словах и случайные опечатки ИИ.
 */
function reconstructReorderOptions(questions: any[], language: string): any[] {
  const isCJK = ['zh', 'ja'].includes(language)
  return questions.map((q) => {
    if (q.type === 'reorder') {
      // Универсальная нормализация для предотвращения чувствительности к регистру
      q.correctAnswer = q.correctAnswer?.toLowerCase().trim() || ''

      // Инициализация допустимых вариантов
      q.acceptableAnswers = Array.isArray(q.acceptableAnswers)
        ? q.acceptableAnswers.map((a: string) => a.toLowerCase().trim())
        : []

      if (!q.acceptableAnswers.includes(q.correctAnswer)) {
        q.acceptableAnswers.unshift(q.correctAnswer)
      }

      if (!isCJK && q.correctAnswer) {
        // Разбиваем правильный ответ по пробелам, предварительно удалив знаки препинания
        const answerWords = q.correctAnswer
          .replace(/[.,!?;:()¿¡"']/g, '')
          .split(/\s+/)
          .filter(Boolean)

        if (answerWords.length > 0) {
          const answerWordsLower = answerWords.map((w: string) => w.toLowerCase())
          const originalOptionsLower = (q.options || []).map((o: string) => String(o).toLowerCase())

          // Сохраняем дистракторы, аккуратно вычитая слова из правильного ответа
          const distractors = originalOptionsLower.filter((opt: string) => {
            const idx = answerWordsLower.indexOf(opt)
            if (idx !== -1) {
              answerWordsLower.splice(idx, 1) // Удаляем 1 совпадение, чтобы разрешить дубликаты
              return false
            }
            return true
          })

          // Читаем заново чистые слова ответа, так как мы модифицировали массив
          const cleanAnswerWords = q.correctAnswer.replace(/[.,!?;:()¿¡"']/g, '').split(/\s+/).filter(Boolean).map((w: string) => w.toLowerCase())
          const allOptions = [...cleanAnswerWords, ...distractors]
          q.options = allOptions.sort(() => Math.random() - 0.5)
        }
      }
      else {
        // Для CJK просто рандомизируем и приводим к нижнему регистру
        q.options = (q.options || []).map((o: string) => String(o).toLowerCase()).sort(() => Math.random() - 0.5)
      }
    }
    return q
  })
}

function validateQuizQuestions(questions: any[]): string | null {
  if (!Array.isArray(questions))
    return 'Quiz is not a valid JSON array'
  if (questions.length < 10)
    return `Quiz array length ${questions.length} is too short, must be at least 10 questions`

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i]
    if (!q.type || !['choice', 'cloze', 'reorder'].includes(q.type)) {
      return `Question ${i + 1} has invalid type: ${q?.type}`
    }
    if (!q.question || typeof q.question !== 'string') {
      return `Question ${i + 1} is missing a text question query`
    }
    if (!q.options || !Array.isArray(q.options) || q.options.length === 0) {
      return `Question ${i + 1} is missing options array`
    }
    if (!q.correctAnswer || typeof q.correctAnswer !== 'string') {
      return `Question ${i + 1} is missing correctAnswer`
    }
    if (!q.explanation || typeof q.explanation !== 'string') {
      return `Question ${i + 1} is missing explanation`
    }

    if (q.type === 'reorder') {
      if (q.question.trim().toLowerCase() === q.correctAnswer.trim().toLowerCase()) {
        return `Question ${i + 1} of type 'reorder' must contain the TRANSLATION of the sentence, not the sentence itself.`
      }
      if (!Array.isArray(q.acceptableAnswers) || q.acceptableAnswers.length === 0) {
        return `Question ${i + 1} of type 'reorder' is missing 'acceptableAnswers' array.`
      }
      if (!q.acceptableAnswers.includes(q.correctAnswer)) {
        return `Question ${i + 1}: 'acceptableAnswers' must include the 'correctAnswer'.`
      }
    }

    if (q.type === 'choice' || q.type === 'cloze') {
      if (!q.options.includes(q.correctAnswer)) {
        return `Question ${i + 1} correctAnswer "${q.correctAnswer}" is not present in options list [${q.options.join(', ')}]`
      }
    }
  }
  return null
}

export async function generateLevelQuiz(
  userId: number,
  language: string,
  targetLang: string,
  levelValue: string,
  words: string[],
  config: LlmConfig,
): Promise<any[]> {
  await checkTokenLimit(userId)
  if (!config.url)
    throw new AppError(500, 'LLM API не настроен')

  const prompt = getQuizGenerationPrompt(language, targetLang, levelValue)

  const messages: ModelMessage[] = [
    { role: 'system', content: prompt },
    { role: 'user', content: `Generate a quiz using a selection from these words: ${words.join(', ')}` },
  ]

  const modelsToTry = [config.model, config.fallbackModel].filter(Boolean) as string[]
  let lastError: Error | null = null

  for (const model of modelsToTry) {
    try {
      const { parsed } = await callLlmJsonWithRetry<any[]>(
        model,
        messages,
        0.5,
        AbortSignal.timeout(90000),
        config,
        raw => parseLlmJson<any[]>(raw),
        (usage, rawText, messagesUsed) => {
          trackTokenUsage(userId, `generate_quiz`, model, usage.promptTokens, usage.completionTokens, JSON.stringify(messagesUsed, null, 2), rawText)
        },
      )

      if (Array.isArray(parsed) && parsed.length > 0) {
        let validQuiz = parsed
        const validationError = validateQuizQuestions(parsed)
        if (validationError) {
          console.warn(`[Quiz critic] Validation failed: ${validationError}. Requesting correction...`)

          const correctionMessages: ModelMessage[] = [
            ...messages,
            { role: 'assistant', content: JSON.stringify(parsed) },
            { role: 'user', content: `CRITICAL ERROR in your generated quiz: ${validationError}. Please fix the errors and output the corrected full JSON array of questions.` },
          ]

          const corrected = await callLlmJsonWithRetry<any[]>(
            model,
            correctionMessages,
            0.2,
            AbortSignal.timeout(90000),
            config,
            raw => parseLlmJson<any[]>(raw),
            (usage, rawText, messagesUsed) => {
              trackTokenUsage(userId, `generate_quiz`, model, usage.promptTokens, usage.completionTokens, JSON.stringify(messagesUsed, null, 2), rawText)
            },
          )

          const finalError = validateQuizQuestions(corrected.parsed)
          if (!finalError) {
            validQuiz = corrected.parsed
          }
          else {
            console.warn(`[Quiz critic] Correction also failed: ${finalError}. Proceeding with original.`)
          }
        }

        const srcLangName = getLangName(language)
        const targetLangName = getLangName(targetLang)

        const reviewerMessages: ModelMessage[] = [
          {
            role: 'system',
            content: `You are an expert ${srcLangName} linguist and test reviewer for the ${levelValue} level. 
Your task is to review the provided JSON quiz.
1. Fix any grammatical or logical errors in the questions, options, or explanations.
2. Ensure that the vocabulary and grammar strictly adhere to the ${levelValue} level. Simplify overly complex sentences or words.
3. Ensure the 'correctAnswer' perfectly solves the question and is mathematically/logically sound.
4. For 'reorder' questions, YOU MUST ENSURE the translation perfectly matches the 'correctAnswer' and NO WORDS ARE DROPPED (e.g., if there's 'now' or 'initially', it must be translated).
5. For 'reorder' questions, you MUST brainstorm and add ALL possible valid word orders to the 'acceptableAnswers' array to prevent failing students for alternative valid wordings.
6. For 'reorder' questions, DO NOT remove extra distractor words from the 'options' array. Distractors are intentional and MUST be kept! Ensure all words in 'acceptableAnswers' can be built from 'options'.
7. CRITICAL: The "question" field for "choice" and "reorder" types MUST remain strictly in the student's native language (${targetLangName}). Do NOT translate these question texts to ${srcLangName}.
8. To prevent capitalization hints, make sure all 'options', 'correctAnswer', and 'acceptableAnswers' are entirely lowercase.
9. For 'cloze' questions, verify that ONLY the 'correctAnswer' fits the blank. If any distractor in the 'options' can also grammatically and logically fit the blank (e.g., both "меня" and "её" for "___ зовут Анна"), REPLACE that distractor with an unequivocally incorrect word so there is NO ambiguity.
10. If the quiz is mostly good, just return the improved JSON array of questions with your fixes applied.
Output MUST be a valid JSON array of question objects, exactly matching the schema. No markdown formatting outside of JSON.`,
          },
          { role: 'user', content: JSON.stringify(validQuiz) },
        ]

        try {
          const reviewed = await callLlmJsonWithRetry<any[]>(
            model,
            reviewerMessages,
            0.3,
            AbortSignal.timeout(90000),
            config,
            raw => parseLlmJson<any[]>(raw),
            (usage, rawText, messagesUsed) => {
              trackTokenUsage(userId, `generate_quiz`, model, usage.promptTokens, usage.completionTokens, JSON.stringify(messagesUsed, null, 2), rawText)
            },
          )

          const reviewError = validateQuizQuestions(reviewed.parsed)
          if (!reviewError && Array.isArray(reviewed.parsed) && reviewed.parsed.length > 0) {
            return reconstructReorderOptions(reviewed.parsed, language)
          }
          console.warn(`[Quiz Reviewer] Semantic correction broke schema: ${reviewError}. Returning original technically valid quiz.`)
          return reconstructReorderOptions(validQuiz, language)
        }
        catch (revError) {
          console.warn(`[Quiz Reviewer] LLM reviewer failed. Returning original technically valid quiz.`, revError)
          return reconstructReorderOptions(validQuiz, language)
        }
      }
      throw new Error('LLM did not return a valid quiz array')
    }
    catch (e) {
      lastError = e as Error
      console.warn(`[LLM Quiz Generation] Failed with model [${model}]:`, lastError.message)
    }
  }

  throw new AppError(500, `Не удалось сгенерировать вопросы: ${lastError?.message || 'Unknown error'}`)
}
