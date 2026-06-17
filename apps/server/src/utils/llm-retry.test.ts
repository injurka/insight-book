import type { ModelMessage } from 'ai'
import type { LlmConfig } from '~/types'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { z } from 'zod'
import { callLlmJsonWithRetry } from './llm-api'

describe('callLlmJsonWithRetry wrapper tests', () => {
  let originalFetch: typeof globalThis.fetch
  let fetchMock: any
  let requestBodies: any[] = []
  let mockResponses: Array<(url: string, init?: RequestInit) => Promise<Response>> = []

  beforeEach(() => {
    originalFetch = globalThis.fetch
    requestBodies = []
    mockResponses = []
    fetchMock = async (url: string, init?: RequestInit) => {
      if (init?.body) {
        requestBodies.push(JSON.parse(init.body as string))
      }
      const responseHandler = mockResponses.shift()
      if (!responseHandler) {
        throw new Error('No mock response provided in mockResponses queue')
      }
      return responseHandler(url, init)
    }
    globalThis.fetch = fetchMock as any
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  function queueMockResponse(status: number, body: any) {
    mockResponses.push(async () => {
      return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
      })
    })
  }

  function queueOpenAiResponse(
    content: string,
    promptTokens = 10,
    completionTokens = 20,
    status = 200,
  ) {
    queueMockResponse(status, {
      choices: [
        {
          message: {
            role: 'assistant',
            content,
          },
        },
      ],
      usage: {
        prompt_tokens: promptTokens,
        completion_tokens: completionTokens,
      },
    })
  }

  test('Happy path: valid JSON is returned immediately without retry', async () => {
    const config: LlmConfig = { url: 'http://example.com/v1', key: 'test-key' }
    const messages: ModelMessage[] = [{ role: 'user', content: 'Say hello in JSON' }]
    const responseJson = { message: 'hello' }

    queueOpenAiResponse(JSON.stringify(responseJson), 10, 20)

    const schema = z.object({ message: z.string() })
    const parseFn = (text: string) => schema.parse(JSON.parse(text))

    const result = await callLlmJsonWithRetry(
      'gpt-4',
      messages,
      0.7,
      new AbortController().signal,
      config,
      parseFn,
    )

    expect(result.parsed).toEqual(responseJson)
    expect(result.text).toBe(JSON.stringify(responseJson))
    expect(result.usage).toEqual({ promptTokens: 10, completionTokens: 20 })
    expect(requestBodies.length).toBe(1)
  })

  test('Retry path: invalid JSON syntax triggers exactly 1 retry and succeeds', async () => {
    const config: LlmConfig = { url: 'http://example.com/v1', key: 'test-key' }
    const messages: ModelMessage[] = [{ role: 'user', content: 'Say hello in JSON' }]

    queueOpenAiResponse('{ invalid json', 10, 20)
    queueOpenAiResponse(JSON.stringify({ message: 'recovered' }), 15, 25)

    const schema = z.object({ message: z.string() })
    const parseFn = (text: string) => schema.parse(JSON.parse(text))

    const result = await callLlmJsonWithRetry(
      'gpt-4',
      messages,
      0.7,
      new AbortController().signal,
      config,
      parseFn,
    )

    expect(result.parsed).toEqual({ message: 'recovered' })
    expect(result.text).toBe(JSON.stringify({ message: 'recovered' }))
    expect(result.usage).toEqual({ promptTokens: 25, completionTokens: 45 })
    expect(requestBodies.length).toBe(2)

    // Verify retry message history construction
    const secondCallMessages = requestBodies[1].messages
    expect(secondCallMessages.length).toBe(3)
    expect(secondCallMessages[0]).toEqual({ role: 'user', content: 'Say hello in JSON' })
    expect(secondCallMessages[1]).toEqual({ role: 'assistant', content: '{ invalid json' })
    expect(secondCallMessages[2].content).toContain('Your previous response was not valid JSON')
    expect(secondCallMessages[2].content).toContain('JSON Parse error')
  })

  test('Retry path: ZodError triggers exactly 1 retry and succeeds', async () => {
    const config: LlmConfig = { url: 'http://example.com/v1', key: 'test-key' }
    const messages: ModelMessage[] = [{ role: 'user', content: 'Say hello in JSON' }]

    queueOpenAiResponse(JSON.stringify({ msg: 'invalid key' }), 10, 20)
    queueOpenAiResponse(JSON.stringify({ message: 'recovered' }), 15, 25)

    const schema = z.object({ message: z.string() })
    const parseFn = (text: string) => schema.parse(JSON.parse(text))

    const result = await callLlmJsonWithRetry(
      'gpt-4',
      messages,
      0.7,
      new AbortController().signal,
      config,
      parseFn,
    )

    expect(result.parsed).toEqual({ message: 'recovered' })
    expect(result.usage).toEqual({ promptTokens: 25, completionTokens: 45 })
    expect(requestBodies.length).toBe(2)

    const secondCallMessages = requestBodies[1].messages
    expect(secondCallMessages[1].content).toContain('msg')
    expect(secondCallMessages[2].content).toContain('invalid_type')
  })

  test('Retry path: Custom parseFn exception triggers exactly 1 retry and succeeds', async () => {
    const config: LlmConfig = { url: 'http://example.com/v1', key: 'test-key' }
    const messages: ModelMessage[] = [{ role: 'user', content: 'Say hello in JSON' }]

    queueOpenAiResponse(JSON.stringify({ score: -10 }), 10, 20)
    queueOpenAiResponse(JSON.stringify({ score: 10 }), 15, 25)

    const parseFn = (text: string) => {
      const parsed = JSON.parse(text)
      if (parsed.score < 0) {
        throw new Error('Score must be positive')
      }
      return parsed
    }

    const result = await callLlmJsonWithRetry(
      'gpt-4',
      messages,
      0.7,
      new AbortController().signal,
      config,
      parseFn,
    )

    expect(result.parsed).toEqual({ score: 10 })
    expect(requestBodies.length).toBe(2)

    const secondCallMessages = requestBodies[1].messages
    expect(secondCallMessages[2].content).toContain('Score must be positive')
  })

  test('Double failure path: both calls return invalid JSON, propagates exception, no more retries', async () => {
    const config: LlmConfig = { url: 'http://example.com/v1', key: 'test-key' }
    const messages: ModelMessage[] = [{ role: 'user', content: 'Say hello in JSON' }]

    queueOpenAiResponse('{ invalid 1', 10, 20)
    queueOpenAiResponse('{ invalid 2', 15, 25)

    const schema = z.object({ message: z.string() })
    const parseFn = (text: string) => schema.parse(JSON.parse(text))

    let errorThrown: any = null
    try {
      await callLlmJsonWithRetry(
        'gpt-4',
        messages,
        0.7,
        new AbortController().signal,
        config,
        parseFn,
      )
    }
    catch (e) {
      errorThrown = e
    }

    expect(errorThrown).toBeInstanceOf(SyntaxError)
    expect(requestBodies.length).toBe(2)
  })

  test('Token usage callback is invoked for both attempts when provided', async () => {
    const config: LlmConfig = { url: 'http://example.com/v1', key: 'test-key' }
    const messages: ModelMessage[] = [{ role: 'user', content: 'Say hello in JSON' }]

    queueOpenAiResponse('{ invalid json', 10, 20)
    queueOpenAiResponse(JSON.stringify({ message: 'recovered' }), 15, 25)

    const schema = z.object({ message: z.string() })
    const parseFn = (text: string) => schema.parse(JSON.parse(text))

    const usages: Array<{ usage: any, text: string, messages: ModelMessage[] }> = []
    const onTokenUsage = (usage: any, rawText: string, msgs: ModelMessage[]) => {
      usages.push({ usage, text: rawText, messages: msgs })
    }

    const result = await callLlmJsonWithRetry(
      'gpt-4',
      messages,
      0.7,
      new AbortController().signal,
      config,
      parseFn,
      onTokenUsage,
    )

    expect(result.parsed).toEqual({ message: 'recovered' })
    expect(usages.length).toBe(2)

    // First invocation
    expect(usages[0].usage).toEqual({ promptTokens: 10, completionTokens: 20 })
    expect(usages[0].text).toBe('{ invalid json')
    expect(usages[0].messages).toEqual(messages)

    // Second invocation
    expect(usages[1].usage).toEqual({ promptTokens: 15, completionTokens: 25 })
    expect(usages[1].text).toBe(JSON.stringify({ message: 'recovered' }))
    expect(usages[1].messages.length).toBe(3)
  })
})
