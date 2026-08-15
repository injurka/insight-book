import type { LlmConfig } from '~/types'
import { CORS_HEADERS } from '~/config'
import { getAiConfig } from './ai-config'

// Валидация слов по письменности — общий модуль (packages/language-utils),
// единый источник правды для server и client
export { isValidWordForLanguage, normalizeLanguageCode } from '@injurka/insight-book-language-utils'

export function hashTtsText(text: string, voice: string): string {
  const hasher = new Bun.CryptoHasher('sha256')
  hasher.update(text.trim().toLowerCase() + voice.toLowerCase())
  return hasher.digest('hex')
}

export function mapVoiceToOpenAi(geminiVoice: string): string {
  const map: Record<string, string> = {
    kore: 'alloy',
    callirrhoe: 'shimmer',
    orus: 'nova',
    puck: 'echo',
    charon: 'onyx',
    fenrir: 'fable',
    leda: 'alloy',
  }
  return map[geminiVoice.toLowerCase()] || 'alloy'
}

export function hashSentence(sentence: string, language: string, targetLang: string): string {
  const hasher = new Bun.CryptoHasher('sha256')
  hasher.update(`${(language || 'en').toLowerCase()}::${(targetLang || 'ru').toLowerCase()}::${sentence.trim().toLowerCase()}`)

  return hasher.digest('hex')
}

export function isOldFormatAnalysis(parsed: unknown): boolean {
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

export function extractLlmConfig(req: Request): LlmConfig {
  const aiConfig = getAiConfig()

  // TTS/STT/OCR всегда наследуются из серверного ai-config:
  // кастомные заголовки переопределяют только LLM-триплет.
  const media = {
    ttsModel: aiConfig.tts.model,
    fallbackTtsModel: aiConfig.tts.fallbackModel,
    ttsUrl: aiConfig.tts.url,
    ttsKey: aiConfig.tts.key,
    sttModel: aiConfig.stt.model,
    fallbackSttModel: aiConfig.stt.fallbackModel,
    sttUrl: aiConfig.stt.url,
    sttKey: aiConfig.stt.key,
    ocrModel: aiConfig.ocr.model,
    ocrRefinementModel: aiConfig.ocr.refinementModel,
    ocrUrl: aiConfig.ocr.url,
    ocrKey: aiConfig.ocr.key,
  }

  // Приоритет моделей: пользовательская (X-Custom-Llm-*) → серверная (llm).
  const customUrl = req.headers.get('x-custom-llm-url')
  const customModel = req.headers.get('x-custom-llm-model')
  if (customUrl && customModel) {
    return {
      url: customUrl,
      key: req.headers.get('x-custom-llm-key') || '',
      model: customModel,
      fallbackModel: customModel,
      ...media,
    }
  }

  const base = aiConfig.llm

  return {
    url: base.url,
    key: base.key,
    model: base.model,
    fallbackModel: base.fallbackModel,
    ...media,
  }
}

export function extractUniqueWordsFromHtml(html: string): string[] {
  const words = new Set<string>()
  const regex = /data-word="([^"]+)"/g
  let match

  // eslint-disable-next-line no-cond-assign
  while ((match = regex.exec(html)) !== null) {
    try {
      const word = decodeURIComponent(match[1])
      if (/[\p{L}\p{N}]/u.test(word)) {
        words.add(word)
        words.add(word.toLowerCase())
      }
    }
    catch { }
  }
  return Array.from(words)
}

export function json(data: unknown, status = 200, extraHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...CORS_HEADERS,
      'Content-Type': 'application/json',
      ...extraHeaders,
    },
  })
}

export function parseLlmJson<T = unknown>(raw: string): T {
  let text = raw.trim()

  // eslint-disable-next-line regexp/no-super-linear-backtracking
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)(?:```|$)/i)
  if (jsonMatch && jsonMatch[1].trim()) {
    text = jsonMatch[1].trim()
  }

  const firstBrace = text.search(/[{[]/)
  const lastBrace = Math.max(text.lastIndexOf('}'), text.lastIndexOf(']'))

  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace >= firstBrace) {
    text = text.substring(firstBrace, lastBrace + 1)
  }
  else if (firstBrace !== -1) {
    text = text.substring(firstBrace)
  }

  try {
    return JSON.parse(text) as T
  }
  catch (error: unknown) {
    const snippet = text.length > 100 ? `${text.substring(0, 100)}...` : text
    throw new Error(`JSON Parse Error: ${(error as Error).message}. Snippet: ${snippet}`)
  }
}
