import type { ModelMessage } from '../types'
import type { TokenUsage } from '../utils/llm-api'
import { Elysia, t } from 'elysia'
import jwt from 'jsonwebtoken'
import { AUTH_MODE, JWT_SECRET } from '../config'
import { ERROR_CODES } from '../constants/error-codes'
import { checkTokenLimit } from '../services/limits.service'
import { trackTokenUsage } from '../services/token.service'
import { AppError, handleElysiaError } from '../utils/errors'
import { extractLlmConfig, parseLlmJson } from '../utils/helpers'
import { callLlmApi, callLlmJsonWithRetry } from '../utils/llm-api'
import { logger } from '../utils/logger'

const authPlugin = new Elysia().derive({ as: 'scoped' }, ({ headers }) => {
  if (AUTH_MODE === 'single')
    return { userId: 1 }
  const authHeader = headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer '))
    throw new AppError(401, ERROR_CODES.AUTH.UNAUTHORIZED, 'Unauthorized')
  const token = authHeader.split(' ')[1]
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: number }
    return { userId: decoded.userId }
  }
  catch {
    throw new AppError(401, ERROR_CODES.AUTH.INVALID_TOKEN, 'Invalid token')
  }
})

export const llmController = new Elysia({ prefix: '/api/llm' })
  .use(authPlugin)
  .onError(handleElysiaError)
  .post('/generate', async ({ userId, body, request }) => {
    await checkTokenLimit(userId)
    const config = extractLlmConfig(request)

    if (!config.url)
      throw new AppError(500, ERROR_CODES.SYSTEM.LLM_NOT_CONFIGURED, 'LLM API not configured')

    const messages: ModelMessage[] = []
    if (body.messages && body.messages.length > 0) {
      for (const m of body.messages) {
        messages.push({ role: m.role, content: m.content })
      }
    }
    else {
      if (body.systemPrompt) {
        messages.push({ role: 'system', content: body.systemPrompt })
      }
      if (body.prompt) {
        messages.push({ role: 'user', content: body.prompt })
      }
    }

    if (messages.length === 0) {
      throw new AppError(400, ERROR_CODES.SYSTEM.VALIDATION_ERROR, 'No prompt or messages provided')
    }

    const action = body.action || 'llm_generate'
    const temperature = body.temperature ?? 0.3
    const isJson = body.json ?? true
    const modelsToTry = [config.model, config.fallbackModel].filter(Boolean) as string[]
    let lastError: Error | null = null

    for (const model of modelsToTry) {
      try {
        if (isJson) {
          const { parsed, usage } = await callLlmJsonWithRetry<unknown>(
            model,
            messages,
            temperature,
            AbortSignal.timeout(90000),
            config,
            raw => parseLlmJson<unknown>(raw),
            (tokenUsage: TokenUsage, rawText: string, messagesUsed: ModelMessage[]) => {
              trackTokenUsage(
                userId,
                action,
                model,
                tokenUsage.promptTokens,
                tokenUsage.completionTokens,
                JSON.stringify(messagesUsed, null, 2),
                rawText,
              )
            },
          )

          return {
            success: true,
            data: parsed,
            usage,
          }
        }
        else {
          const { text, usage } = await callLlmApi(
            model,
            messages,
            temperature,
            AbortSignal.timeout(90000),
            config,
            false,
          )

          trackTokenUsage(
            userId,
            action,
            model,
            usage.promptTokens,
            usage.completionTokens,
            JSON.stringify(messages, null, 2),
            text,
          )

          return {
            success: true,
            text,
            usage,
          }
        }
      }
      catch (e) {
        lastError = e as Error
        logger.warn({ err: lastError }, `[LLM Generate Controller] Failed with model [${model}]:`)
      }
    }

    throw new AppError(500, ERROR_CODES.SYSTEM.LLM_ERROR, `LLM generation failed: ${lastError?.message || 'Unknown error'}`)
  }, {
    body: t.Object({
      action: t.Optional(t.String()),
      prompt: t.Optional(t.String()),
      systemPrompt: t.Optional(t.String()),
      messages: t.Optional(t.Array(t.Object({
        role: t.Union([t.Literal('system'), t.Literal('user'), t.Literal('assistant')]),
        content: t.String(),
      }))),
      json: t.Optional(t.Boolean()),
      temperature: t.Optional(t.Number()),
    }),
  })
