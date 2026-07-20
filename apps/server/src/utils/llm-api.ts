import type { ModelMessage } from 'ai'
import type { z } from 'zod'
import type { LlmConfig } from '~/types'
import { createOpenAI } from '@ai-sdk/openai'
import { generateObject, generateText } from 'ai'

export interface TokenUsage {
  promptTokens: number
  completionTokens: number
}

function getAiModel(config: LlmConfig, modelName: string) {
  let baseURL = config.url.replace(/\/+$/, '')

  // Normalize URLs to OpenAI-compatible endpoints
  if (baseURL.includes(':11434') || baseURL.endsWith('/api/chat') || baseURL.includes('/api/chat?')) {
    if (baseURL.endsWith('/api/chat')) {
      baseURL = baseURL.slice(0, -'/api/chat'.length)
    }
    baseURL = `${baseURL}/v1`
  }
  else {
    if (baseURL.endsWith('/chat/completions')) {
      baseURL = baseURL.slice(0, -'/chat/completions'.length)
    }
    else if (baseURL.endsWith('/v1')) {
      // already good
    }
    else if (!/\/v\d+(?:beta)?$/i.test(baseURL)) {
      baseURL = `${baseURL}/v1`
    }
  }

  const openai = createOpenAI({
    baseURL,
    apiKey: config.key || 'dummy-key',
  })

  return openai(modelName)
}

function contentToText(content: unknown): string {
  if (content == null)
    return ''
  if (typeof content === 'string')
    return content
  if (Array.isArray(content)) {
    return content.map((part) => {
      if (part == null)
        return ''
      if (typeof part === 'string')
        return part
      const obj = part as Record<string, unknown>
      if (obj.type === 'text')
        return obj.text ?? ''
      if ('text' in obj)
        return obj.text ?? ''
      if (obj.type === 'image')
        return '[image omitted]'
      if (obj.type === 'file')
        return '[file omitted]'
      return ''
    }).join('')
  }
  if (typeof content === 'object') {
    const obj = content as Record<string, unknown>
    if ('text' in obj)
      return String(obj.text ?? '')
    return JSON.stringify(content)
  }
  return String(content)
}

function convertMessages(messages: ModelMessage[]) {
  const systemMessages = messages.filter(m => m.role === 'system').map(m => contentToText(m.content))
  const coreMessages = messages.filter(m => m.role !== 'system').map(m => ({
    role: (m.role === 'tool') ? 'user' : m.role,
    content: contentToText(m.content),
  }))
  return { system: systemMessages.join('\n\n'), coreMessages }
}

export async function callLlmApi(
  modelName: string,
  messages: ModelMessage[],
  temperature: number,
  signal: AbortSignal,
  config: LlmConfig,
): Promise<{ text: string, usage: TokenUsage }> {
  try {
    const { system, coreMessages } = convertMessages(messages)
    const result = await generateText({
      model: getAiModel(config, modelName),
      system,
      messages: coreMessages as any,
      temperature,
      abortSignal: signal,
    })

    return {
      text: result.text,
      usage: {
        promptTokens: result.usage.inputTokens || 0,
        completionTokens: result.usage.outputTokens || 0,
      },
    }
  }
  catch (error: unknown) {
    const errObj = error as { message?: string }
    throw new Error(
      `AI SDK Error[${modelName}]: ${errObj?.message || JSON.stringify(error)} `,
    )
  }
}

export async function callLlmStructured<T>(
  modelName: string,
  messages: ModelMessage[],
  temperature: number,
  signal: AbortSignal,
  config: LlmConfig,
  schema: z.ZodType<T>,
  onTokenUsage?: (usage: TokenUsage, rawText: string, messagesUsed: ModelMessage[]) => void,
): Promise<{ parsed: T, text: string, usage: TokenUsage }> {
  try {
    const { system, coreMessages } = convertMessages(messages)

    const result = await generateObject({
      model: getAiModel(config, modelName),
      schema,
      system,
      messages: coreMessages,
      temperature,
      abortSignal: signal,
    })

    const usage = {
      promptTokens: result.usage.inputTokens || 0,
      completionTokens: result.usage.outputTokens || 0,
    }
    const rawResponse = JSON.stringify(result.object)

    if (onTokenUsage) {
      onTokenUsage(usage, rawResponse, messages)
    }

    return { parsed: result.object as T, text: rawResponse, usage }
  }
  catch (error: unknown) {
    const errObj = error as { message?: string }
    throw new Error(
      `AI SDK Object Generation Error[${modelName}]: ${errObj?.message || JSON.stringify(error)} `,
    )
  }
}
