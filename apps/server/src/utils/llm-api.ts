import type { ModelMessage } from 'ai'
import type { LlmConfig } from '~/types'
import { parseLlmJson } from './helpers'

const MAX_OUTPUT_TOKENS = 8192

interface OpenAiChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
}

interface GeminiContent {
  role: 'user' | 'model'
  parts: Array<{ text: string }>
}

export interface TokenUsage {
  promptTokens: number
  completionTokens: number
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
  forceJson: boolean = false,
): Promise<{ text: string, usage: TokenUsage }> {
  try {
    if (isOllamaNativeUrl(config.url)) {
      return await callOllamaNative({
        modelName,
        messages,
        temperature,
        signal,
        config,
        forceJson,
      })
    }

    if (isGeminiNativeUrl(config.url)) {
      return await callGeminiNative({
        modelName,
        messages,
        temperature,
        signal,
        config,
        forceJson,
      })
    }

    return await callOpenAiCompatible({
      modelName,
      messages,
      temperature,
      signal,
      config,
      forceJson,
    })
  }
  catch (error: unknown) {
    const errObj = error as any
    throw new Error(
      `AI SDK Error[${modelName}]: ${errObj?.message || JSON.stringify(error)} `,
    )
  }
}

/**
 * Универсальная обертка для запросов с автоматическим Retry в случае невалидного JSON
 */
async function callLlmJsonWithRetry<T = any>(
  modelName: string,
  messages: ModelMessage[],
  temperature: number,
  signal: AbortSignal,
  config: LlmConfig,
  parseFn: (text: string) => T = parseLlmJson,
  onTokenUsage?: (usage: TokenUsage, rawText: string, messagesUsed: ModelMessage[]) => void,
): Promise<{ parsed: T, text: string, usage: TokenUsage }> {
  // Для JSON структуры принудительно требуем JSON формат
  const res = await callLlmApi(modelName, messages, temperature, signal, config, true)
  const rawResponse = res.text
  const usage = res.usage

  if (onTokenUsage) {
    onTokenUsage(usage, rawResponse, messages)
  }

  try {
    const parsed = parseFn(rawResponse)
    return { parsed, text: rawResponse, usage }
  }
  catch (parseError: unknown) {
    const err = parseError as Error
    console.warn(`[LLM JSON Parse Retry] First attempt failed to parse JSON. Error: ${err.message || err}. Retrying...`)

    // Отправляем модели её же ответ и текст ошибки парсинга, требуя строгий JSON
    const retryMessages: ModelMessage[] = [
      ...messages,
      { role: 'assistant', content: rawResponse },
      {
        role: 'user',
        content: `Your previous response was not valid JSON. Please fix it. Error details: ${err.message || err}. Make sure to output ONLY valid JSON.`,
      },
    ]

    const retryRes = await callLlmApi(modelName, retryMessages, temperature, signal, config, true)
    const retryRawResponse = retryRes.text
    const retryUsage = retryRes.usage

    if (onTokenUsage) {
      onTokenUsage(retryUsage, retryRawResponse, retryMessages)
    }

    try {
      const parsed = parseFn(retryRawResponse)
      const combinedUsage = {
        promptTokens: usage.promptTokens + retryUsage.promptTokens,
        completionTokens: usage.completionTokens + retryUsage.completionTokens,
      }
      return { parsed, text: retryRawResponse, usage: combinedUsage }
    }
    catch (retryParseError: any) {
      console.error(`[LLM JSON Parse Retry] Second attempt also failed to parse JSON. Error: ${retryParseError.message || retryParseError}`)
      throw retryParseError
    }
  }
}

export { callLlmApi, callLlmJsonWithRetry }

async function callOpenAiCompatible(params: {
  modelName: string
  messages: ModelMessage[]
  temperature: number
  signal: AbortSignal
  config: LlmConfig
  forceJson?: boolean
}): Promise<{ text: string, usage: TokenUsage }> {
  const {
    modelName,
    messages,
    temperature,
    signal,
    config,
    forceJson,
  } = params

  const url = buildOpenAiChatCompletionsUrl(config.url)

  const baseBody: Record<string, any> = {
    model: modelName,
    messages: toOpenAiMessages(messages),
    temperature,
    stream: false,
    max_tokens: MAX_OUTPUT_TOKENS,
  }

  // Native JSON Mode для OpenAI
  if (forceJson) {
    baseBody.response_format = { type: 'json_object' }
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  if (config.key) {
    headers.Authorization = `Bearer ${config.key}`
  }

  const bodyVariants: Record<string, any>[] = [
    baseBody,
  ]

  if (forceJson) {
    const withoutResponseFormat = { ...baseBody }
    delete withoutResponseFormat.response_format
    bodyVariants.push(withoutResponseFormat)
  }

  const withoutMaxTokens = { ...baseBody }
  delete withoutMaxTokens.max_tokens

  if (forceJson) {
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
      const promptTokens = data?.usage?.prompt_tokens || 0
      const completionTokens = data?.usage?.completion_tokens || 0
      const usage = { promptTokens, completionTokens }

      if (typeof content === 'string') {
        return { text: content, usage }
      }

      if (Array.isArray(content)) {
        const text = content
          .map((part: any) => {
            if (typeof part === 'string')
              return part
            if (part?.type === 'text')
              return part.text ?? ''
            if ('text' in part)
              return part.text ?? ''
            return ''
          })
          .join('')

        if (text) {
          return { text, usage }
        }
      }

      throw new Error(`Пустой ответ от OpenAI-compatible API: ${JSON.stringify(data)}`)
    }
    catch (error: unknown) {
      lastError = error

      if (!isProbablyUnsupportedParameterError(error)) {
        throw error
      }
    }
  }

  throw lastError
}

async function callGeminiNative(params: {
  modelName: string
  messages: ModelMessage[]
  temperature: number
  signal: AbortSignal
  config: LlmConfig
  forceJson?: boolean
}): Promise<{ text: string, usage: TokenUsage }> {
  const {
    modelName,
    messages,
    temperature,
    signal,
    config,
    forceJson,
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

  {
    const body = structuredCloneJson(baseBody)
    if (forceJson) {
      body.generationConfig.responseMimeType = 'application/json'
      body.generationConfig.response_mime_type = 'application/json'
    }
    body.generationConfig.thinkingConfig = { thinkingBudget: 0 }
    bodyVariants.push(body)
  }

  {
    const body = structuredCloneJson(baseBody)
    if (forceJson) {
      body.generationConfig.responseMimeType = 'application/json'
      body.generationConfig.response_mime_type = 'application/json'
    }
    bodyVariants.push(body)
  }

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
      const promptTokens = data?.usageMetadata?.promptTokenCount || 0
      const completionTokens = data?.usageMetadata?.candidatesTokenCount || 0
      const usage = { promptTokens, completionTokens }

      if (Array.isArray(parts)) {
        const text = parts
          .map((part: any) => part?.text ?? '')
          .join('')

        if (text) {
          return { text, usage }
        }
      }

      throw new Error(`Пустой ответ от Gemini API: ${JSON.stringify(data)}`)
    }
    catch (error: unknown) {
      lastError = error

      if (!isProbablyUnsupportedParameterError(error)) {
        throw error
      }
    }
  }

  throw lastError
}

async function callOllamaNative(params: {
  modelName: string
  messages: ModelMessage[]
  temperature: number
  signal: AbortSignal
  config: LlmConfig
  forceJson?: boolean
}): Promise<{ text: string, usage: TokenUsage }> {
  const {
    modelName,
    messages,
    temperature,
    signal,
    config,
    forceJson,
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

  // Native JSON Mode для Ollama
  if (forceJson) {
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
  const promptTokens = data?.prompt_eval_count || 0
  const completionTokens = data?.eval_count || 0
  const usage = { promptTokens, completionTokens }

  if (typeof content === 'string') {
    return { text: content, usage }
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
        if (part == null)
          return ''
        if (typeof part === 'string')
          return part
        if (part.type === 'text')
          return part.text ?? ''
        if ('text' in part)
          return part.text ?? ''
        if (part.type === 'image')
          return '[image omitted]'
        if (part.type === 'file')
          return '[file omitted]'
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
  if (role === 'system')
    return 'system'
  if (role === 'assistant')
    return 'assistant'
  if (role === 'tool')
    return 'tool'
  return 'user'
}

function normalizeOllamaRole(role: string): 'system' | 'user' | 'assistant' {
  if (role === 'system')
    return 'system'
  if (role === 'assistant')
    return 'assistant'
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

  if (url.endsWith('/chat/completions'))
    return url
  if (url.endsWith('/responses'))
    return `${url.slice(0, -'/responses'.length)}/chat/completions`
  if (/\/v\d+(?:beta)?$/i.test(url))
    return `${url}/chat/completions`

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

  if (url.endsWith('/api/chat'))
    return url
  if (url.endsWith('/v1'))
    url = url.slice(0, -'/v1'.length)

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
