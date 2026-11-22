import type {
  InsightBookPluginApiFacade,
  PluginLlmGeneratePayload,
} from '@injurka/insight-book-plugin-api'
import { getPluginApi as getGlobalPluginApi } from '@injurka/insight-book-plugin-api'

let localPluginApi: InsightBookPluginApiFacade | null = null

export function setLocalPluginApi(api: InsightBookPluginApiFacade): void {
  localPluginApi = api
}

export function getPluginApi(): InsightBookPluginApiFacade | null {
  return localPluginApi ?? getGlobalPluginApi()
}

function extractLlmData<T>(res: { success: boolean, data?: unknown, text?: string } | null): T | null {
  if (!res?.success) {
    return null
  }

  if (res.data !== undefined && res.data !== null) {
    return res.data as T
  }

  if (typeof res.text === 'string' && res.text.trim()) {
    try {
      const cleaned = res.text.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim()

      return JSON.parse(cleaned) as T
    }
    catch {
      return null
    }
  }

  return null
}

export async function requestLlmGenerate<T = unknown>(params: PluginLlmGeneratePayload): Promise<T | null> {
  const api = getPluginApi()
  const payload: PluginLlmGeneratePayload = {
    ...params,
    json: params.json ?? true,
    action: params.action || 'chinese_sentence_deep_analyze',
  }

  if (api?.llm?.generate) {
    const res = await api.llm.generate<T>(payload)

    return extractLlmData<T>(res)
  }

  if (api?.request) {
    const res = await api.request<{ success: boolean, data?: T, text?: string }>('/api/llm/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload as unknown as Record<string, unknown>,
      withLlm: true,
    })

    return extractLlmData<T>(res)
  }

  const res = await fetch('/api/llm/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    throw new Error(`LLM request failed with status ${res.status}`)
  }

  const data = await res.json() as { success: boolean, data?: T, text?: string }

  return extractLlmData<T>(data)
}

async function fetchSpeechToTextFallback(fd: FormData): Promise<string> {
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

  if (language && language !== 'auto') {
    fd.append('language', language)
  }

  if (api?.request) {
    const res = await api.request<{ text?: string }>('/api/tts/transcribe', {
      method: 'POST',
      body: fd,
      withLlm: true,
    })

    return res.text?.trim() ?? ''
  }

  return fetchSpeechToTextFallback(fd)
}

export async function requestTtsAudio(text: string, voice = 'default'): Promise<string | null> {
  const api = getPluginApi()
  const payload = { text, voice }

  try {
    if (api?.request) {
      const res = await api.request<{ audioBase64?: string }>('/api/tts', {
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
