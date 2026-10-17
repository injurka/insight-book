import type { LlmConfig, ModelMessage } from '../types'
import { expect, it, spyOn } from 'bun:test'
import * as llmApi from '../utils/llm-api'
import * as limits from './limits.service'
import { generateWordAutoFill } from './word-analysis.service'

it('isolates concurrent autofill by user and model while deduplicating identical requests', async () => {
  let release!: () => void
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  const limit = spyOn(limits, 'checkTokenLimit').mockImplementation(async () => gate)
  const api = spyOn(llmApi, 'callLlmJsonWithRetry').mockImplementation(async <T>(
    model: string,
    _messages: ModelMessage[],
    _temperature: number,
    _signal: AbortSignal,
    _config: LlmConfig,
    parse?: (text: string) => T,
  ) => {
    if (!parse)
      throw new Error('Expected a parser')
    const text = JSON.stringify({ translation: model, difficulty: 'A1' })
    return { parsed: parse(text), text, usage: { promptTokens: 0, completionTokens: 0 } }
  })
  try {
    const config = { url: 'https://example.invalid', model: 'model-a' }
    const first = generateWordAutoFill(1, 'word', 'en', 'ru', config)
    const duplicate = generateWordAutoFill(1, 'word', 'en', 'ru', config)
    const otherUser = generateWordAutoFill(2, 'word', 'en', 'ru', config)
    const otherModel = generateWordAutoFill(1, 'word', 'en', 'ru', { ...config, model: 'model-b' })
    expect(limit).toHaveBeenCalledTimes(3)
    release()
    const results = await Promise.all([first, duplicate, otherUser, otherModel])
    expect(api).toHaveBeenCalledTimes(3)
    expect(results.map(result => result.translation)).toEqual(['model-a', 'model-a', 'model-a', 'model-b'])
  }
  finally {
    release()
    limit.mockRestore()
    api.mockRestore()
  }
})
