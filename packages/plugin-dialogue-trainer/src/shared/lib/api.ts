import type {
  InsightBookPluginApiFacade,
  PluginLlmGeneratePayload,
} from '@injurka/insight-book-plugin-api'
import { getPluginApi as getGlobalPluginApi } from '@injurka/insight-book-plugin-api'

let localPluginApi: InsightBookPluginApiFacade | null = null

export function setPluginApi(api: InsightBookPluginApiFacade) {
  localPluginApi = api
}

export function getPluginApi(): InsightBookPluginApiFacade | null {
  return localPluginApi ?? getGlobalPluginApi()
}

function extractLlmResult<T>(res: { success: boolean, data?: unknown, text?: string }, isJson?: boolean): T | null {
  if (!res.success) {
    return null
  }

  if (isJson === false && typeof res.text === 'string') {
    return res.text as unknown as T
  }

  return (res.data ?? null) as T | null
}

export async function requestLlmGenerate<T = unknown>(params: PluginLlmGeneratePayload): Promise<T | null> {
  const api = getPluginApi()

  if (!api?.llm?.generate) {
    throw new Error('Plugin API LLM is not initialized')
  }

  const res = await api.llm.generate<T>({
    ...params,
    json: params.json ?? true,
    action: params.action || 'dialogue_trainer_chat',
  })

  if (!res) {
    return null
  }

  return extractLlmResult<T>(res, params.json)
}

async function fetchSttFallback(fd: FormData): Promise<string> {
  const res = await fetch('/api/tts/transcribe', {
    method: 'POST',
    body: fd,
  })

  if (!res.ok) {
    throw new Error(`STT failed with status ${res.status}`)
  }

  const data = await res.json() as { text?: string }

  return data.text?.trim() ?? ''
}

export async function requestSpeechToText(audioBlob: Blob, language?: string): Promise<string> {
  const api = getPluginApi()
  const fd = new FormData()
  fd.append('audio', audioBlob, 'speech.webm')

  if (language) {
    fd.append('language', language)
  }

  if (api?.request) {
    const res = await api.request<{ text: string }>('/api/tts/transcribe', {
      method: 'POST',
      body: fd,
      withLlm: true,
    })

    return res.text?.trim() ?? ''
  }

  return fetchSttFallback(fd)
}

export async function requestTtsAudio(text: string, voice?: string): Promise<string | null> {
  const api = getPluginApi()
  const payload = { text, voice: voice || 'default' }

  try {
    if (api?.request) {
      const res = await api.request<{ audioBase64: string }>('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload as unknown as Record<string, unknown>,
      })

      return res?.audioBase64 || null
    }

    const res = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!res.ok) {
      return null
    }

    const data = await res.json() as { audioBase64?: string }

    return data?.audioBase64 || null
  }
  catch {
    return null
  }
}

export interface ServerTokenizeResult {
  sentences: Array<{
    sentId: number
    rawSent: string
    tokens: Array<{
      word: string
      pos: string
      tokenIdx: number
      isPunct: boolean
      spacingClass: string
    }>
  }>
}

export async function requestNlpTokenize(text: string, language: string, baseSentId = 0): Promise<ServerTokenizeResult | null> {
  const api = getPluginApi()
  const payload = { text, language, baseSentId }

  try {
    if (api?.request) {
      return await api.request<ServerTokenizeResult>('/api/nlp/tokenize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload as unknown as Record<string, unknown>,
      })
    }

    const res = await fetch('/api/nlp/tokenize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!res.ok) {
      return null
    }

    return await res.json() as ServerTokenizeResult
  }
  catch {
    return null
  }
}
