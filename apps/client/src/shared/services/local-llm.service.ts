import type { BookStats, GeneratedWordExamples, LlmAnalysis, WordAutoFillResponse } from '../types/models'
import { BOOK_ANALYSIS_PROMPT, getMangaAnalysisPrompt, getSystemPrompt, getWordAutoFillPrompt, getWordExamplesPrompt } from '../lib/prompts'
import { api } from './api.service'

export interface LocalLlmConfig {
  customLlmUrl: string
  customLlmKey: string
  customLlmModel: string
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string | Record<string, unknown>[]
}

export const localLlmService = {
  async _callLlmApi(
    model: string,
    messages: ChatMessage[],
    temperature: number,
    config: LocalLlmConfig,
    signal?: AbortSignal,
  ): Promise<string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    if (config.customLlmKey) {
      headers.Authorization = `Bearer ${config.customLlmKey}`
    }

    const response = await fetch(`${config.customLlmUrl}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model,
        response_format: { type: 'json_object' },
        messages,
        temperature,
      }),
      signal,
    })

    if (!response.ok) {
      throw new Error(`Local LLM API error ${response.status}: ${await response.text()}`)
    }

    const data = await response.json()

    if (data.error)
      throw new Error(data.error.message || JSON.stringify(data.error))
    if (!data.choices || !data.choices[0]?.message?.content)
      throw new Error('Invalid LLM response')

    return data.choices[0].message.content
  },

  async analyzeSentence(
    sentence: string,
    language: string,
    targetLang: string,
    config: LocalLlmConfig,
    signal?: AbortSignal,
  ): Promise<LlmAnalysis> {
    const messages: ChatMessage[] = [
      { role: 'system', content: getSystemPrompt(language, targetLang) },
      { role: 'user', content: `Текст: ${sentence}` },
    ]
    const raw = await this._callLlmApi(config.customLlmModel, messages, 0.2, config, signal)
    const cleanJson = raw.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim()

    return JSON.parse(cleanJson)
  },

  async generateWordExamples(
    word: string,
    language: string,
    targetLang: string,
    config: LocalLlmConfig,
  ): Promise<GeneratedWordExamples> {
    const messages: ChatMessage[] = [
      { role: 'system', content: getWordExamplesPrompt(language, targetLang) },
      { role: 'user', content: `Слово: ${word}` },
    ]
    const raw = await this._callLlmApi(config.customLlmModel, messages, 0.4, config)
    const cleanJson = raw.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim()

    return JSON.parse(cleanJson)
  },

  async generateWordAutoFill(
    word: string,
    language: string,
    targetLang: string,
    config: LocalLlmConfig,
  ): Promise<WordAutoFillResponse> {
    const messages: ChatMessage[] = [
      { role: 'system', content: getWordAutoFillPrompt(language, targetLang) },
      { role: 'user', content: `Слово: ${word}` },
    ]
    const raw = await this._callLlmApi(config.customLlmModel, messages, 0.4, config)
    const cleanJson = raw.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim()

    return JSON.parse(cleanJson)
  },

  async analyzeBookStats(
    id: number,
    config: LocalLlmConfig,
  ): Promise<{ success: boolean, stats: BookStats }> {
    const book = await api.books.getInfo(id)
    let aiData

    if (book.type === 'manga') {
      const promptText = getMangaAnalysisPrompt(book.language)
      const authorInfo = book.author ? ` Автор: ${book.author}` : ''
      const messages: ChatMessage[] = [
        { role: 'system', content: promptText },
        { role: 'user', content: `Название манги/комикса: "${book.title}".${authorInfo}` },
      ]
      const raw = await this._callLlmApi(config.customLlmModel, messages, 0.3, config)
      const cleanJson = raw.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim()
      aiData = JSON.parse(cleanJson)
    }
    else {
      let excerpt = ''
      for (let i = 1; i <= Math.min(book.totalPages, 5); i++) {
        if (excerpt.length >= 3000)
          break
        const page = await api.books.getPage(id, i)
        const tempDiv = document.createElement('div')
        tempDiv.innerHTML = page.content || ''
        excerpt += `${tempDiv.textContent}\n`
      }
      excerpt = excerpt.substring(0, 3000)

      const messages: ChatMessage[] = [
        { role: 'system', content: BOOK_ANALYSIS_PROMPT },
        { role: 'user', content: `Отрывок книги:\n\n${excerpt}` },
      ]
      const raw = await this._callLlmApi(config.customLlmModel, messages, 0.3, config)
      const cleanJson = raw.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim()
      aiData = JSON.parse(cleanJson)
    }

    const tagsJson = aiData.tags || []
    const descriptionJson = typeof aiData.description === 'string'
      ? aiData.description
      : JSON.stringify(aiData.description || {})

    const res = await api.books.updateStats(id, {
      description: descriptionJson,
      difficulty: aiData.difficulty,
      tags: tagsJson,
    })

    return res
  },
}
