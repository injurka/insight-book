import type { LlmConfig } from '~/types'
import { CORS_HEADERS } from '~/config'
import { getAiConfig } from './ai-config'

export function hashTtsText(text: string, voice: string): string {
  const hasher = new Bun.CryptoHasher('sha256')
  hasher.update(text.trim().toLowerCase() + voice)

  return hasher.digest('hex')
}

export function getVoiceForLanguage(language: string): string {
  switch (language.toLowerCase()) {
    case 'en': return 'alloy'
    case 'zh': return 'shimmer'
    case 'ja': return 'nova'
    default: return 'alloy'
  }
}

export function hashSentence(sentence: string, language: string, targetLang: string): string {
  const hasher = new Bun.CryptoHasher('sha256')
  hasher.update(`${(language || 'en').toLowerCase()}::${(targetLang || 'ru').toLowerCase()}::${sentence.trim().toLowerCase()}`)

  return hasher.digest('hex')
}

export function extractLlmConfig(req: Request): LlmConfig {
  const customUrl = req.headers.get('x-custom-llm-url')
  const customModel = req.headers.get('x-custom-llm-model')
  const aiConfig = getAiConfig()

  if (customUrl && customModel) {
    return {
      url: customUrl,
      key: req.headers.get('x-custom-llm-key') || '',
      model: customModel,
      fallbackModel: customModel,
      ttsModel: 'tts-1',
      ttsUrl: customUrl,
      ttsKey: req.headers.get('x-custom-llm-key') || '',
      sttModel: 'whisper-1',
      sttUrl: customUrl,
      sttKey: req.headers.get('x-custom-llm-key') || '',
      ocrModel: customModel,
      ocrRefinementModel: customModel,
      ocrUrl: customUrl,
      ocrKey: req.headers.get('x-custom-llm-key') || '',
    }
  }

  return {
    url: aiConfig.llm.url,
    key: aiConfig.llm.key,
    model: aiConfig.llm.model,
    fallbackModel: aiConfig.llm.fallbackModel,
    ttsModel: aiConfig.tts.model,
    ttsUrl: aiConfig.tts.url,
    ttsKey: aiConfig.tts.key,
    sttModel: aiConfig.stt.model,
    sttUrl: aiConfig.stt.url,
    sttKey: aiConfig.stt.key,
    ocrModel: aiConfig.ocr.model,
    ocrRefinementModel: aiConfig.ocr.refinementModel,
    ocrUrl: aiConfig.ocr.url,
    ocrKey: aiConfig.ocr.key,
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

export function corsOk() {
  return new Response(null, { status: 204, headers: CORS_HEADERS })
}

export function parseLlmJson<T = any>(raw: string): T {
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
  catch (error: any) {
    const snippet = text.length > 100 ? `${text.substring(0, 100)}...` : text
    throw new Error(`JSON Parse Error: ${error.message}. Snippet: ${snippet}`)
  }
}
