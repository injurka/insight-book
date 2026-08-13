import type { LlmConfig, ModelMessage } from '../types'
import { eq } from 'drizzle-orm'
import { pinyin } from 'pinyin-pro'
import { convertToOpus } from '~/utils/audio'
import { attachUrlToActiveSpan, runWithClientSpan } from '~/utils/external-call'
import { hashTtsText, mapVoiceToOpenAi, parseLlmJson } from '~/utils/helpers'
import { callLlmJsonWithRetry } from '~/utils/llm-api'
import { ERROR_CODES } from '../constants/error-codes'
import { db } from '../db'
import * as schema from '../db/schema'
import { AppError } from '../utils/errors'
import { logger } from '../utils/logger'
import { checkTokenLimit } from './limits.service'
import { trackTokenUsage } from './token.service'

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
    throw new AppError(400, ERROR_CODES.TTS.TEXT_REQUIRED, 'Text is required')

  const hasChineseChars = /[\u4E00-\u9FA5]/.test(normalizedText)
  const maxLength = hasChineseChars ? 80 : 250

  if (normalizedText.length > maxLength) {
    throw new AppError(400, ERROR_CODES.TTS.TEXT_TOO_LONG, 'Text is too long for TTS', { maxLength })
  }

  const ttsUrl = config.ttsUrl || config.url
  const ttsKey = config.ttsKey || config.key
  const primaryModel = config.ttsModel!
  const fallbackModel = config.fallbackTtsModel || 'gemini-2.5-flash-preview-tts'

  if (!ttsUrl)
    throw new AppError(500, ERROR_CODES.TTS.NOT_CONFIGURED, 'TTS API not configured')

  const voice = selectedVoice || 'Kore'
  const hash = hashTtsText(normalizedText, voice)

  const cached = await db.query.ttsCache.findFirst({
    where: eq(schema.ttsCache.textHash, hash),
  })

  if (cached && !forceCacheBypass) {
    if (bookId) {
      await db.insert(schema.bookTtsCache).values({ bookId, textHash: hash }).onConflictDoNothing()
    }
    return Buffer.from(cached.audioBlob).toString('base64')
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
    const formatToTry = isGemini ? 'wav' : 'opus'
    const requestBody = {
      model,
      input: textToRead,
      voice: voiceName,
      response_format: formatToTry,
    }

    return await runWithClientSpan(
      `TTS ${model}`,
      {
        'gen_ai.system': isGemini ? 'gemini' : 'openai',
        'gen_ai.request.model': model,
        'http.request.method': 'POST',
        'http.method': 'POST',
      },
      async () => {
        attachUrlToActiveSpan(`${ttsUrl}/audio/speech`)

        let response = await fetch(`${ttsUrl}/audio/speech`, {
          method: 'POST',
          headers,
          body: JSON.stringify(requestBody),
          signal: AbortSignal.timeout(60000),
        })

        if (!response.ok && formatToTry === 'opus') {
          // Fallback to mp3 if provider API doesn't accept 'opus' format
          requestBody.response_format = 'mp3'
          response = await fetch(`${ttsUrl}/audio/speech`, {
            method: 'POST',
            headers,
            body: JSON.stringify(requestBody),
            signal: AbortSignal.timeout(60000),
          })
        }

        if (!response.ok) {
          const errorText = await response.text()
          throw new AppError(500, ERROR_CODES.TTS.GENERATION_FAILED, `TTS API error ${response.status}: ${errorText}`)
        }

        const arrayBuffer = await response.arrayBuffer()

        if (arrayBuffer.byteLength === 0) {
          throw new AppError(500, ERROR_CODES.TTS.GENERATION_FAILED, 'TTS API returned empty audio data')
        }

        const rawBuffer = Buffer.from(new Uint8Array(arrayBuffer))
        return convertToOpus(rawBuffer)
      },
    )
  }

  let audioBuffer: Buffer = Buffer.from(new Uint8Array(0))
  const isPrimaryGemini = primaryModel.toLowerCase().includes('gemini')
  let usedModel = primaryModel

  try {
    audioBuffer = await tryGenerate(primaryModel, voice, isPrimaryGemini)
  }
  catch (error: unknown) {
    if ((error as Error).name === 'AbortError')
      throw error

    logger.warn(`[TTS] Primary model (${primaryModel}) failed for text: "${normalizedText.substring(0, 20)}". Error: ${(error as Error).message}`)

    if (fallbackModel && fallbackModel !== primaryModel) {
      logger.info(`[TTS] Trying fallback model (${fallbackModel})...`)
      const isFallbackGemini = fallbackModel.toLowerCase().includes('gemini')
      const fallbackVoice = isFallbackGemini ? voice : mapVoiceToOpenAi(voice)

      try {
        audioBuffer = await tryGenerate(fallbackModel, fallbackVoice, isFallbackGemini)
        usedModel = fallbackModel
      }
      catch (fallbackError: unknown) {
        if ((fallbackError as Error).name === 'AbortError')
          throw fallbackError
        logger.error(`[TTS] Fallback model (${fallbackModel}) also failed.`)
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
    audioBlob: audioBuffer,
  }).onConflictDoUpdate({
    target: schema.ttsCache.textHash,
    set: {
      text: normalizedText,
      audioBlob: audioBuffer,
    },
  })

  if (bookId) {
    await db.insert(schema.bookTtsCache).values({ bookId, textHash: hash }).onConflictDoNothing()
  }

  trackTokenUsage(userId, 'tts_generation', usedModel, normalizedText.length, 0, normalizedText, '[AUDIO BASE64]')

  return audioBuffer.toString('base64')
}

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
    throw new AppError(500, ERROR_CODES.TTS.NOT_CONFIGURED, getErrorMsg('not_configured'))

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

    return await runWithClientSpan(
      `STT ${model}`,
      {
        'gen_ai.system': 'openai',
        'gen_ai.request.model': model,
        'http.request.method': 'POST',
        'http.method': 'POST',
      },
      async () => {
        attachUrlToActiveSpan(apiUrl)

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

        return response.json() as Promise<{ text?: string, usage?: { prompt_tokens?: number, completion_tokens?: number } }>
      },
    )
  }

  try {
    let data: { text?: string, usage?: { prompt_tokens?: number, completion_tokens?: number } }
    let usedSttModel = sttModel

    try {
      data = await doSttRequest(sttModel)
    }
    catch (primaryErr: unknown) {
      if (fallbackSttModel && fallbackSttModel !== sttModel) {
        logger.warn(`[STT] Primary model (${sttModel}) failed, trying fallback (${fallbackSttModel})...`)
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
        logger.warn(e, '[Audio Service] Failed to analyze heard text via LLM:')
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

    logger.error(err, '[Audio Service] Pronunciation Check Failed:')
    throw new AppError(500, ERROR_CODES.TTS.GENERATION_FAILED, getErrorMsg('recognition_failed', err.message))
  }
}
