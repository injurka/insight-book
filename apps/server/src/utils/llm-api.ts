import type { ModelMessage } from 'ai'
import type { LlmConfig } from '~/types'

const MAX_OUTPUT_TOKENS = 8192

/**
 * Если твои промпты всегда ожидают JSON — оставь true.
 * Если эта функция используется не только для JSON-ответов — поставь false.
 */
const FORCE_JSON_OUTPUT = true

interface OpenAiChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
}

interface GeminiContent {
  role: 'user' | 'model'
  parts: Array<{ text: string }>
}

class LlmHttpError extends Error {
  status?: number
  body?: string

  constructor(message: string, status?: number, body?: string) {
    super(message)
    this.name = 'LlmHttpError'
    this.status = status
    this.body = body
  }
}

async function callLlmApi(
  modelName: string,
  messages: ModelMessage[],
  temperature: number,
  signal: AbortSignal,
  config: LlmConfig,
) {
  try {
    if (isOllamaNativeUrl(config.url)) {
      return await callOllamaNative({
        modelName,
        messages,
        temperature,
        signal,
        config,
      })
    }

    if (isGeminiNativeUrl(config.url)) {
      return await callGeminiNative({
        modelName,
        messages,
        temperature,
        signal,
        config,
      })
    }

    return await callOpenAiCompatible({
      modelName,
      messages,
      temperature,
      signal,
      config,
    })
  }
  catch (error: any) {
    throw new Error(
      `AI SDK Error[${modelName}]: ${error?.message || JSON.stringify(error)} `,
    )
  }
}

export { callLlmApi }

/**
 * OpenAI-compatible API.
 *
 * Подходит для:
 * - OpenAI Chat Completions
 * - OpenRouter
 * - AIHubMix
 * - LM Studio OpenAI-compatible
 * - Ollama, если используешь http://localhost:11434/v1
 *
 * Важно:
 * Здесь специально НЕ добавляется reasoning_effort.
 * Для gpt-4o-mini reasoning/thinking нет, отключать нечего.
 */
async function callOpenAiCompatible(params: {
  modelName: string
  messages: ModelMessage[]
  temperature: number
  signal: AbortSignal
  config: LlmConfig
}) {
  const {
    modelName,
    messages,
    temperature,
    signal,
    config,
  } = params

  const url = buildOpenAiChatCompletionsUrl(config.url)

  const baseBody: Record<string, any> = {
    model: modelName,
    messages: toOpenAiMessages(messages),
    temperature,
    stream: false,
    max_tokens: MAX_OUTPUT_TOKENS,
  }

  if (FORCE_JSON_OUTPUT) {
    baseBody.response_format = { type: 'json_object' }
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  if (config.key) {
    headers.Authorization = `Bearer ${config.key}`
  }

  /**
   * Некоторые OpenAI-compatible провайдеры не поддерживают response_format.
   * Поэтому сначала пробуем с JSON mode, потом без него.
   */
  const bodyVariants: Record<string, any>[] = [
    baseBody,
  ]

  if (FORCE_JSON_OUTPUT) {
    const withoutResponseFormat = { ...baseBody }
    delete withoutResponseFormat.response_format
    bodyVariants.push(withoutResponseFormat)
  }

  /**
   * Некоторые совместимые API могут ругаться на max_tokens.
   * В таком случае пробуем ещё раз без лимита.
   */
  const withoutMaxTokens = { ...baseBody }
  delete withoutMaxTokens.max_tokens

  if (FORCE_JSON_OUTPUT) {
    bodyVariants.push(withoutMaxTokens)

    const withoutMaxTokensAndResponseFormat = { ...withoutMaxTokens }
    delete withoutMaxTokensAndResponseFormat.response_format
    bodyVariants.push(withoutMaxTokensAndResponseFormat)
  }
  else {
    bodyVariants.push(withoutMaxTokens)
  }

  let lastError: unknown

  for (const body of bodyVariants) {
    try {
      const data = await postJson<any>({
        url,
        body,
        signal,
        headers,
      })

      const content = data?.choices?.[0]?.message?.content

      if (typeof content === 'string') {
        return content
      }

      if (Array.isArray(content)) {
        const text = content
          .map((part: any) => {
            if (typeof part === 'string') {
              return part
            }

            if (part?.type === 'text') {
              return part.text ?? ''
            }

            if ('text' in part) {
              return part.text ?? ''
            }

            return ''
          })
          .join('')

        if (text) {
          return text
        }
      }

      throw new Error(`Пустой ответ от OpenAI-compatible API: ${JSON.stringify(data)}`)
    }
    catch (error: any) {
      lastError = error

      if (!isProbablyUnsupportedParameterError(error)) {
        throw error
      }
    }
  }

  throw lastError
}

/**
 * Gemini native API.
 *
 * Подходит для:
 * https://generativelanguage.googleapis.com/v1beta
 *
 * Здесь thinking отключается корректно:
 *
 * generationConfig: {
 *   thinkingConfig: {
 *     thinkingBudget: 0
 *   }
 * }
 *
 * Если конкретная модель/endpoint не поддерживает thinkingConfig,
 * код автоматически повторит запрос без этого поля.
 */
async function callGeminiNative(params: {
  modelName: string
  messages: ModelMessage[]
  temperature: number
  signal: AbortSignal
  config: LlmConfig
}) {
  const {
    modelName,
    messages,
    temperature,
    signal,
    config,
  } = params

  const url = buildGeminiGenerateContentUrl(config.url, modelName, config.key)

  const { systemText, contents } = toGeminiMessages(messages)

  const baseBody: Record<string, any> = {
    contents,
    generationConfig: {
      temperature,
      maxOutputTokens: MAX_OUTPUT_TOKENS,
    },
  }

  if (systemText) {
    baseBody.systemInstruction = {
      parts: [{ text: systemText }],
    }
  }

  const bodyVariants: Record<string, any>[] = []

  /**
   * 1. Самый желаемый вариант:
   * JSON output + thinkingBudget 0.
   */
  {
    const body = structuredCloneJson(baseBody)

    if (FORCE_JSON_OUTPUT) {
      body.generationConfig.responseMimeType = 'application/json'
    }

    body.generationConfig.thinkingConfig = {
      thinkingBudget: 0,
    }

    bodyVariants.push(body)
  }

  /**
   * 2. Если thinkingConfig не поддерживается:
   * JSON output без thinkingConfig.
   */
  {
    const body = structuredCloneJson(baseBody)

    if (FORCE_JSON_OUTPUT) {
      body.generationConfig.responseMimeType = 'application/json'
    }

    bodyVariants.push(body)
  }

  /**
   * 3. Если responseMimeType тоже не поддерживается:
   * обычный текстовый ответ.
   */
  bodyVariants.push(structuredCloneJson(baseBody))

  let lastError: unknown

  for (const body of bodyVariants) {
    try {
      const data = await postJson<any>({
        url,
        body,
        signal,
        headers: {
          'Content-Type': 'application/json',
        },
      })

      const parts = data?.candidates?.[0]?.content?.parts

      if (Array.isArray(parts)) {
        const text = parts
          .map((part: any) => part?.text ?? '')
          .join('')

        if (text) {
          return text
        }
      }

      throw new Error(`Пустой ответ от Gemini API: ${JSON.stringify(data)}`)
    }
    catch (error: any) {
      lastError = error

      if (!isProbablyUnsupportedParameterError(error)) {
        throw error
      }
    }
  }

  throw lastError
}

/**
 * Ollama native API.
 *
 * Подходит для:
 * http://localhost:11434
 * http://127.0.0.1:11434
 *
 * Если хочешь использовать Ollama через OpenAI-compatible API,
 * укажи URL так:
 *
 * http://localhost:11434/v1
 *
 * Тогда будет использован callOpenAiCompatible.
 */
async function callOllamaNative(params: {
  modelName: string
  messages: ModelMessage[]
  temperature: number
  signal: AbortSignal
  config: LlmConfig
}) {
  const {
    modelName,
    messages,
    temperature,
    signal,
    config,
  } = params

  const url = buildOllamaChatUrl(config.url)

  const body: Record<string, any> = {
    model: modelName,
    messages: toOllamaMessages(messages),
    stream: false,
    keep_alive: '-1',
    options: {
      temperature,
      num_ctx: 8192,
    },
  }

  if (FORCE_JSON_OUTPUT) {
    body.format = 'json'
  }

  const data = await postJson<any>({
    url,
    body,
    signal,
    headers: {
      'Content-Type': 'application/json',
    },
  })

  const content = data?.message?.content

  if (typeof content === 'string') {
    return content
  }

  throw new Error(`Пустой ответ от Ollama API: ${JSON.stringify(data)}`)
}

async function postJson<T>(params: {
  url: string
  body: unknown
  signal: AbortSignal
  headers?: Record<string, string>
}): Promise<T> {
  const {
    url,
    body,
    signal,
    headers = {},
  } = params

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal,
  })

  const text = await response.text()

  if (!response.ok) {
    throw new LlmHttpError(
      `HTTP ${response.status}: ${text}`,
      response.status,
      text,
    )
  }

  if (!text) {
    throw new Error('Пустой HTTP-ответ от LLM API')
  }

  try {
    return JSON.parse(text) as T
  }
  catch {
    throw new Error(`LLM API вернул не JSON: ${text}`)
  }
}

function toOpenAiMessages(messages: ModelMessage[]): OpenAiChatMessage[] {
  return messages.map((message: any) => {
    const role = normalizeOpenAiRole(message.role)

    return {
      role,
      content: contentToText(message.content),
    }
  })
}

function toOllamaMessages(messages: ModelMessage[]) {
  return messages.map((message: any) => {
    const role = normalizeOllamaRole(message.role)

    return {
      role,
      content: contentToText(message.content),
    }
  })
}

function toGeminiMessages(messages: ModelMessage[]): {
  systemText: string
  contents: GeminiContent[]
} {
  const systemParts: string[] = []
  const contents: GeminiContent[] = []

  for (const message of messages as any[]) {
    const text = contentToText(message.content)

    if (!text) {
      continue
    }

    if (message.role === 'system') {
      systemParts.push(text)
      continue
    }

    contents.push({
      role: message.role === 'assistant' ? 'model' : 'user',
      parts: [{ text }],
    })
  }

  return {
    systemText: systemParts.join('\n\n'),
    contents,
  }
}

function contentToText(content: any): string {
  if (content == null) {
    return ''
  }

  if (typeof content === 'string') {
    return content
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (part == null) {
          return ''
        }

        if (typeof part === 'string') {
          return part
        }

        if (part.type === 'text') {
          return part.text ?? ''
        }

        if ('text' in part) {
          return part.text ?? ''
        }

        /**
         * Если у тебя есть мультимодальные сообщения,
         * сюда можно добавить обработку image/file.
         */
        if (part.type === 'image') {
          return '[image omitted]'
        }

        if (part.type === 'file') {
          return '[file omitted]'
        }

        return ''
      })
      .join('')
  }

  if (typeof content === 'object') {
    if ('text' in content) {
      return String(content.text ?? '')
    }

    return JSON.stringify(content)
  }

  return String(content)
}

function normalizeOpenAiRole(role: string): OpenAiChatMessage['role'] {
  if (role === 'system') {
    return 'system'
  }

  if (role === 'assistant') {
    return 'assistant'
  }

  if (role === 'tool') {
    return 'tool'
  }

  return 'user'
}

function normalizeOllamaRole(role: string): 'system' | 'user' | 'assistant' {
  if (role === 'system') {
    return 'system'
  }

  if (role === 'assistant') {
    return 'assistant'
  }

  return 'user'
}

function isOllamaNativeUrl(url: string): boolean {
  const normalized = url.toLowerCase()

  if (normalized.includes('/v1')) {
    return false
  }

  return (
    normalized.includes(':11434')
    || normalized.endsWith('/api/chat')
    || normalized.includes('/api/chat?')
  )
}

function isGeminiNativeUrl(url: string): boolean {
  const normalized = url.toLowerCase()

  return (
    normalized.includes('generativelanguage.googleapis.com')
    || normalized.includes(':generatecontent')
  )
}

function buildOpenAiChatCompletionsUrl(baseUrl: string): string {
  const url = stripTrailingSlash(baseUrl)

  if (url.endsWith('/chat/completions')) {
    return url
  }

  if (url.endsWith('/responses')) {
    return `${url.slice(0, -'/responses'.length)}/chat/completions`
  }

  if (/\/v\d+(?:beta)?$/i.test(url)) {
    return `${url}/chat/completions`
  }

  return `${url}/v1/chat/completions`
}

function buildGeminiGenerateContentUrl(
  baseUrl: string,
  modelName: string,
  apiKey?: string,
): string {
  let url = stripTrailingSlash(baseUrl)

  if (!url.includes(':generateContent')) {
    if (!/\/v1(?:beta|alpha)?$/i.test(url) && !url.endsWith('/models')) {
      url = `${url}/v1beta`
    }

    const modelPath = modelName.startsWith('models/')
      ? modelName
      : `models/${modelName}`

    if (url.endsWith('/models')) {
      url = `${url}/${modelName}:generateContent`
    }
    else {
      url = `${url}/${modelPath}:generateContent`
    }
  }

  if (!apiKey) {
    return url
  }

  const parsedUrl = new URL(url)

  if (!parsedUrl.searchParams.has('key')) {
    parsedUrl.searchParams.set('key', apiKey)
  }

  return parsedUrl.toString()
}

function buildOllamaChatUrl(baseUrl: string): string {
  let url = stripTrailingSlash(baseUrl)

  if (url.endsWith('/api/chat')) {
    return url
  }

  if (url.endsWith('/v1')) {
    url = url.slice(0, -'/v1'.length)
  }

  return `${url}/api/chat`
}

function stripTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '')
}

function structuredCloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value))
}

function isProbablyUnsupportedParameterError(error: any): boolean {
  const message = [
    error?.message,
    error?.body,
  ]
    .filter(Boolean)
    .join('\n')
    .toLowerCase()

  return (
    message.includes('unsupported parameter')
    || message.includes('unknown name')
    || message.includes('unknown field')
    || message.includes('unrecognized request argument')
    || message.includes('invalid json payload')
    || message.includes('response_format')
    || message.includes('responsemime')
    || message.includes('thinkingconfig')
    || message.includes('thinking_config')
    || message.includes('max_tokens')
  )
}
