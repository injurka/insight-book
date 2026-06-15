import type { LlmConfig } from '~/types'
import { CORS_HEADERS, LLM_API_KEY, LLM_API_URL, LLM_FALLBACK_MODEL, LLM_MODEL } from '~/config'

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

  // Символ $ в конце разрешает частичное совпадение при обрыве текста
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)(?:```|$)/i)
  if (jsonMatch && jsonMatch[1].trim()) {
    text = jsonMatch[1].trim()
  }

  const firstBrace = text.search(/[{[]/)
  const lastBrace = Math.max(text.lastIndexOf('}'), text.lastIndexOf(']'))

  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace >= firstBrace) {
    // Есть начало и конец JSON-объекта
    text = text.substring(firstBrace, lastBrace + 1)
  } else if (firstBrace !== -1) {
    // Ответ оборван ИИ-моделью (таймаут или max_tokens) – забираем от открывающей скобки до конца
    text = text.substring(firstBrace)
  }

  try {
    return JSON.parse(text) as T
  } catch (error: any) {
    const snippet = text.length > 100 ? `${text.substring(0, 100)}...` : text
    throw new Error(`JSON Parse Error: ${error.message}. Snippet: ${snippet}`)
  }
}