import type { LlmConfig, ModelMessage } from '../types'
import { BOOK_ANALYSIS_PROMPT, getMangaAnalysisPrompt } from '../prompts'
import { AppError } from '../utils/errors'
import { parseLlmJson } from '../utils/helpers'
import { callLlmJsonWithRetry } from '../utils/llm-api'
import { logger } from '../utils/logger'
import { checkTokenLimit } from './limits.service'
import { trackTokenUsage } from './token.service'

export async function analyzeBookExcerpt(userId: number, excerpt: string, config: LlmConfig): Promise<{ description: string, difficulty: string, tags: string[] }> {
  await checkTokenLimit(userId)

  if (!config.url)
    throw new AppError(500, 'LLM API не настроен')

  const messages: ModelMessage[] = [
    { role: 'system', content: BOOK_ANALYSIS_PROMPT },
    { role: 'user', content: `Отрывок книги:\n\n${excerpt}` },
  ]

  const modelsToTry = [config.model, config.fallbackModel].filter(Boolean) as string[]
  let lastError: Error | null = null

  for (const model of modelsToTry) {
    try {
      const { parsed } = await callLlmJsonWithRetry<{ description: string, difficulty: string, tags: string[] }>(
        model,
        messages,
        0.3,
        AbortSignal.timeout(90000),
        config,
        raw => parseLlmJson(raw),
        (usage, rawText, messagesUsed) => {
          trackTokenUsage(userId, 'analyze_book', model, usage.promptTokens, usage.completionTokens, JSON.stringify(messagesUsed, null, 2), rawText)
        },
      )
      return parsed
    }
    catch (e) {
      lastError = e as Error
      logger.warn({ err: lastError }, `[LLM] Failed with model [${model}]:`)
    }
  }

  if (lastError?.message.includes('No candidates returned') || lastError?.message.includes('safety')) {
    logger.warn('[LLM] Текст заблокирован фильтрами безопасности ИИ на всех моделях. Возвращаем заглушку.')
    return {
      description: 'Краткое описание недоступно. Текст книги был заблокирован внутренними фильтрами безопасности ИИ (вероятно, из-за описания драматических или трагических событий).',
      difficulty: 'Неизвестно',
      tags: ['драма', 'требует проверки'],
    }
  }

  throw new AppError(500, `Ошибка LLM: ${lastError?.message || 'Неизвестная ошибка'}`)
}

export async function analyzeMangaInfo(userId: number, title: string, author: string | null, language: string, config: LlmConfig): Promise<{ description: string, difficulty: string, tags: string[] }> {
  await checkTokenLimit(userId)

  if (!config.url)
    throw new AppError(500, 'LLM API не настроен')

  const promptText = getMangaAnalysisPrompt(language)
  const authorInfo = author ? ` Автор: ${author}` : ''

  const messages: ModelMessage[] = [
    { role: 'system', content: promptText },
    { role: 'user', content: `Название манги/комикса: "${title}".${authorInfo}` },
  ]

  const modelsToTry = [config.model, config.fallbackModel].filter(Boolean) as string[]
  let lastError: Error | null = null

  for (const model of modelsToTry) {
    try {
      const { parsed } = await callLlmJsonWithRetry<{ description: string, difficulty: string, tags: string[] }>(
        model,
        messages,
        0.3,
        AbortSignal.timeout(90000),
        config,
        raw => parseLlmJson(raw),
        (usage, rawText, messagesUsed) => {
          trackTokenUsage(userId, 'analyze_manga', model, usage.promptTokens, usage.completionTokens, JSON.stringify(messagesUsed, null, 2), rawText)
        },
      )
      return parsed
    }
    catch (e) {
      lastError = e as Error
      logger.warn({ err: lastError }, `[LLM] Failed with model [${model}]:`)
    }
  }

  throw new AppError(500, `Ошибка LLM: ${lastError?.message || 'Неизвестная ошибка'}`)
}
