import type { AuthLoginDto, AuthRegisterDto, AuthSendCodeDto, Book, BookStats, CatalogDeck, CatalogPluginRecord, CatalogWord, DictDeck, GeneratedWordExamples, Highlight, LlmAnalysis, PageDictEntry, PagePayload, PromptItem, TocItem, UserData, UserDictItem, UserPluginRecord, WordAutoFillResponse } from '../types/models'
import { fetch as tauriFetch } from '@tauri-apps/plugin-http'
import { ofetch } from 'ofetch'
import { API_URL, isTauri } from '~/01.shared/lib/env'

import { i18n } from '../../00.plugins/i18n'

declare module 'ofetch' {
  interface FetchOptions {
    withLlm?: boolean
    silentErrors?: boolean
  }
}

export const BASE_API_URL = API_URL

export interface CustomLlmConfig {
  url: string
  key: string
  model: string
}

export interface ApiProviders {
  getToken?: () => string | null
  getAppLanguage?: () => string | null
  getCustomLlm?: () => CustomLlmConfig | null
  onUnauthorized?: () => void
  onError?: (message: string) => void
}

function readStoredLanguage(): string | null {
  try {
    const savedLang = localStorage.getItem('global-app-language')

    return savedLang ? savedLang.replace(/^"|"$/g, '') : null
  }
  catch {
    return null
  }
}

const providers: Required<ApiProviders> = {
  getToken: () => localStorage.getItem('insight_token'),
  getAppLanguage: readStoredLanguage,
  getCustomLlm: () => null,
  onUnauthorized: () => { },
  onError: () => { },
}

export function configureApi(overrides: ApiProviders) {
  Object.assign(providers, overrides)
}

export const request = ofetch.create({
  baseURL: BASE_API_URL,
  async onRequest({ options }) {
    options.headers = new Headers(options.headers || {})

    const token = providers.getToken()
    if (token)
      options.headers.set('Authorization', `Bearer ${token}`)

    const appLanguage = providers.getAppLanguage()
    if (appLanguage)
      options.query = { ...options.query, targetLang: appLanguage }

    const customLlm = options.withLlm ? providers.getCustomLlm() : null
    if (customLlm) {
      options.headers.set('X-Custom-Llm-Url', customLlm.url)
      options.headers.set('X-Custom-Llm-Key', customLlm.key)
      options.headers.set('X-Custom-Llm-Model', customLlm.model)
    }
  },
  async onResponseError({ response, options }) {
    let errMessage = response._data?.error || `HTTP ${response.status} ${response.statusText}`

    if (response.status === 500) {
      const isLlmError = options.withLlm || errMessage.includes('LLM') || errMessage.includes('AI')
      errMessage = isLlmError
        ? (i18n.global.t('errors.aiServer'))
        : (i18n.global.t('errors.server500'))
    }

    if (!options.silentErrors) {
      providers.onError(errMessage)
      if (response.status === 401)
        providers.onUnauthorized()
    }

    throw new Error(errMessage)
  },
  async onRequestError({ error, options }) {
    let errMessage = error.message
    if (errMessage.includes('Failed to fetch') || errMessage.includes('Network Error'))
      errMessage = i18n.global.t('errors.network')

    const isAbort = error.name === 'AbortError' || errMessage.toLowerCase().includes('abort') || errMessage.toLowerCase().includes('cancel')

    if (!options?.silentErrors && !isAbort)
      providers.onError(errMessage)

    const finalError = new Error(errMessage)
    if (isAbort)
      finalError.name = 'AbortError'

    throw finalError
  },
}, {
  // Используем нативный fetch плагина HTTP для Tauri, если находимся в окружении десктопного/мобильного приложения
  fetch: isTauri ? tauriFetch as unknown as typeof globalThis.fetch : globalThis.fetch,
})

export const api = {
  auth: {
    login: async (data: AuthLoginDto) => request<{ token: string, user: UserData }>('/api/auth/login', { method: 'POST', body: JSON.stringify(data) }),
    sendCode: async (data: AuthSendCodeDto) => request<{ success: boolean, message: string }>('/api/auth/send-code', { method: 'POST', body: JSON.stringify(data) }),
    register: async (data: AuthRegisterDto) => request<{ token: string, user: UserData }>('/api/auth/register', { method: 'POST', body: JSON.stringify(data) }),
    me: async () => request<{ user: UserData | null, mode: string }>('/api/auth/me'),
    updateAvatar: async (file: File) => {
      const fd = new FormData()
      fd.append('file', file)

      return request<{ success: boolean, avatarUrl: string }>('/api/auth/me/avatar', {
        method: 'PATCH',
        body: fd,
      })
    },
    updateUsername: async (username: string) => request<{ success: boolean, username: string }>('/api/auth/me/username', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username }),
    }),
  },
  books: {
    list: async () => request<Book[]>('/api/books'),
    getPublic: async (query: string) => request<{ data: Book[], total: number, page: number, limit: number }>(`/api/books?${query}`),

    getInfo: async (id: number) => request<Book>(`/api/books/${id}/info`),

    startReading: async (id: number) => request<{ success: boolean }>(`/api/books/${id}/start`, { method: 'POST' }),

    updateInfo: async (id: number, data: Partial<Book>) =>
      request<{ success: boolean }>(`/api/books/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }),

    analyzeBook: async (id: number) => request<{ success: boolean, stats: Book['stats'] }>(`/api/books/${id}/analyze-book`, { method: 'POST', withLlm: true }),

    analyzeVocabulary: async (id: number) => request<{ success: boolean, lexicalStats: Pick<BookStats, 'posDistribution' | 'topWords' | 'lexicalDiversity'> }>(`/api/books/${id}/analyze-vocabulary`, { method: 'POST', withLlm: true }),

    updateCover: async (id: number, file: File) => {
      const fd = new FormData()
      fd.append('file', file)

      return request<{ success: boolean, coverUrl: string }>(`/api/books/${id}/cover`, {
        method: 'PATCH',
        body: fd,
      })
    },

    updateStats: async (id: number, data: Partial<BookStats>) =>
      request<{ success: boolean, stats: BookStats }>(`/api/books/${id}/stats`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }),

    upload: async (file: File) => {
      const fd = new FormData()
      fd.append('file', file)

      return request<{ success: boolean, book: Book }>('/api/books/upload', {
        method: 'POST',
        body: fd,
      })
    },

    createCustomBook: async (data: { title: string, author?: string | null, language: string, type: string }) =>
      request<{ success: boolean, book: Book }>('/api/books/custom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }),

    appendMangaChapter: async (id: number, fd: FormData) =>
      request<{ success: boolean, book: Book }>(`/api/books/${id}/manga-chapter`, {
        method: 'POST',
        body: fd,
      }),

    delete: async (id: number) => request<{ success: boolean }>(`/api/books/${id}`, { method: 'DELETE' }),

    getToc: async (bookId: number) => request<TocItem[]>(`/api/books/${bookId}/toc`),

    getPage: async (bookId: number, page: number, isSync?: boolean) =>
      request<PagePayload>(`/api/books/${bookId}/page/${page}${isSync ? '?sync=true' : ''}`),

    getPageDict: async (bookId: number, page: number) =>
      request<{ pageDictionary: Record<string, PageDictEntry> }>(`/api/books/${bookId}/page/${page}/dict`),

    lookupWord: async (bookId: number, word: string, signal?: AbortSignal) =>
      request<{ transcription: string, translation: string, isUserDict?: boolean }>(`/api/books/${bookId}/word/${encodeURIComponent(word)}`, { signal, silentErrors: true }),

    checkCache: async (
      bookId: number,
      items: { text: string, type: 'sentence' | 'word' }[],
      language: string,
      signal?: AbortSignal,
    ) =>
      request<{ results: { sentence: string, analysis: LlmAnalysis }[] }>(`/api/books/${bookId}/cache-check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items, language }),
        signal,
      }),

    analyzeBatch: async (
      bookId: number,
      items: { id: string, sentence: string, context?: string, type?: 'sentence' | 'word' }[],
      language: string,
      signal?: AbortSignal,
    ) => {
      const targetLanguage = providers.getAppLanguage() || 'ru'

      return request<{ results: { id: string, analysis: LlmAnalysis }[] }>(`/api/books/${bookId}/analyze-batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items, language, targetLanguage }),
        signal,
        withLlm: true,
      })
    },

    analyze: async (
      bookId: number,
      sentence: string,
      language: string,
      context?: string,
      signal?: AbortSignal,
      type: 'sentence' | 'word' = 'sentence',
    ) => {
      const targetLanguage = providers.getAppLanguage() || 'ru'

      return request<LlmAnalysis>(`/api/books/${bookId}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sentence,
          language,
          context,
          targetLanguage,
          type,
        }),
        signal,
        withLlm: true,
      })
    },

    generateTts: async (
      bookId: number,
      text: string,
      voice?: string,
      signal?: AbortSignal,
      forceCacheBypass?: boolean,
    ) =>
      request<{ audioBase64: string, timings?: unknown[] }>(`/api/books/${bookId}/tts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, voice, forceCacheBypass }),
        signal,
      }),

    fetchImageBlob: async (path: string) => {
      const url = path.startsWith('http') ? path : `${BASE_API_URL}${path}`
      const headers = new Headers()
      const token = providers.getToken()
      if (token)
        headers.set('Authorization', `Bearer ${token}`)

      const fetchImplementation = isTauri ? tauriFetch : globalThis.fetch
      const res = await fetchImplementation(url, { headers })
      if (!res.ok)
        throw new Error(`Failed to fetch image: ${res.statusText}`)

      return res.blob()
    },
  },

  tts: {
    generate: async (
      text: string,
      voice?: string,
      signal?: AbortSignal,
      forceCacheBypass?: boolean,
    ) =>
      request<{ audioBase64: string }>(`/api/tts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, voice, forceCacheBypass }),
        signal,
      }),
  },

  dictionary: {
    list: async () => request<UserDictItem[]>('/api/dictionary'),

    decks: async () => request<DictDeck[]>('/api/dictionary/decks'),
    createDeck: async (data: { name: string, language: string }) =>
      request<DictDeck>('/api/dictionary/decks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }),
    updateDeck: async (id: number, data: { name: string }) =>
      request<{ success: boolean }>(`/api/dictionary/decks/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }),
    deleteDeck: async (id: number, mode: 'keep' | 'delete_all' | 'delete_exclusive' = 'keep') =>
      request<{ success: boolean }>(`/api/dictionary/decks/${id}?mode=${mode}`, { method: 'DELETE' }),

    get: async (word: string) => request<UserDictItem>(`/api/dictionary/${encodeURIComponent(word)}`, { silentErrors: true }),
    upsert: async (item: Partial<UserDictItem> & { contextSentence?: string, contextBookId?: number }) =>
      request<{ success: boolean }>('/api/dictionary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item),
      }),
    remove: async (word: string) =>
      request<{ success: boolean }>(`/api/dictionary/${encodeURIComponent(word)}`, { method: 'DELETE' }),

    getReviewQueue: async (opts: { lang: string, mode: 'srs' | 'random' | 'deep_dive' | 'cram' | 'match', deckId?: number | 'none' | 'all', difficulty?: string }) => {
      const queryParams = new URLSearchParams()
      queryParams.set('lang', opts.lang)
      queryParams.set('mode', opts.mode)
      if (opts.deckId !== undefined && opts.deckId !== 'all')
        queryParams.set('deckId', String(opts.deckId))
      if (opts.difficulty && opts.difficulty !== 'all')
        queryParams.set('difficulty', opts.difficulty)

      return request<UserDictItem[]>(`/api/dictionary/review?${queryParams.toString()}`)
    },

    submitReview: async (wordId: number, grade: number) =>
      request<{ success: boolean }>('/api/dictionary/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wordId, grade }),
      }),

    bulkDelete: async (wordIds: number[]) => request<{ success: boolean }>('/api/dictionary/bulk/delete', { method: 'POST', body: JSON.stringify({ wordIds }) }),
    bulkMove: async (wordIds: number[], deckIds: number[]) => request<{ success: boolean }>('/api/dictionary/bulk/move', { method: 'POST', body: JSON.stringify({ wordIds, deckIds }) }),

    generateExamples: async (word: string, language: string) =>
      request<GeneratedWordExamples>('/api/dictionary/generate-examples', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ word, language }),
        withLlm: true,
      }),

    autoFillWord: async (word: string, language: string) =>
      request<WordAutoFillResponse>('/api/dictionary/auto-fill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ word, language }),
        withLlm: true,
      }),

    generateDeepDive: async (word: string, language: string, mode: 'collocations' | 'radicals') =>
      request<unknown>('/api/dictionary/deep-dive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ word, language, mode }),
        withLlm: true,
      }),

    checkPronunciation: async (word: string, language: string, audioBlob: Blob) => {
      const fd = new FormData()
      fd.append('audio', audioBlob, 'speech.webm')
      fd.append('word', word)
      fd.append('language', language)

      return request<{ score: number, heardText: string, heardPhonetic?: string, mistakeAnalysis?: string }>('/api/dictionary/pronunciation', {
        method: 'POST',
        body: fd,
        withLlm: true,
      })
    },

    importCsv: async (data: unknown) => request<{ success: boolean }>('/api/dictionary/import', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }),
    catalog: async () => request<CatalogDeck[]>('/api/dictionary/catalog'),
    catalogWords: async (id: number) => request<CatalogWord[]>(`/api/dictionary/catalog/${id}/words`),
    cloneCatalog: async (id: number) => request<{ success: boolean, deckId: number }>(`/api/dictionary/catalog/${id}/clone`, { method: 'POST' }),
    promptsList: async () => request<PromptItem[]>('/api/dictionary/prompts'),
    promptsCreate: async (data: { name: string, prompt: string }) => request<PromptItem>('/api/dictionary/prompts', { method: 'POST', body: JSON.stringify(data), headers: { 'Content-Type': 'application/json' } }),
    promptsUpdate: async (id: number, data: { name?: string, prompt?: string }) => request<PromptItem>(`/api/dictionary/prompts/${id}`, { method: 'PATCH', body: JSON.stringify(data), headers: { 'Content-Type': 'application/json' } }),
    promptsDelete: async (id: number) => request<{ success: boolean }>(`/api/dictionary/prompts/${id}`, { method: 'DELETE' }),
    chat: async (data: { word: string, language: string, customPromptId?: number, userPromptText?: string }) => request<{ response: string }>('/api/dictionary/chat', { method: 'POST', body: JSON.stringify(data), headers: { 'Content-Type': 'application/json' }, withLlm: true }),
  },

  activity: {
    getStats: async () => request<{ heatmap: { date: string, count: number }[], learnedWords: number, readPages: number, difficulties: { language: string, difficulty: string, count: number }[], quizProgress?: { language: string, levelValue: string, bestScore: number, stars: number, unlocked: boolean }[] }>('/api/activity/stats'),
    getTokens: async (period?: string) => request<{ stats: { action: string, inputTokens: number, outputTokens: number, cost: number }[], daily: { date: string, inputTokens: number, outputTokens: number, cost?: number }[], totalCost: number }>(`/api/activity/tokens${period ? `?period=${period}` : ''}`),
  },

  quiz: {
    getLevels: async (language: string) => request<{ id: number, language: string, levelValue: string, bestScore: number, stars: number, unlocked: boolean }[]>(`/api/quiz/levels?language=${language}`),
    generate: async (language: string, levelValue: string) => request<{ questions: { type: 'choice' | 'cloze' | 'reorder', question: string, options: string[], correctAnswer: string, explanation: string }[], cached: boolean }>('/api/quiz/generate', { method: 'POST', body: JSON.stringify({ language, levelValue }), headers: { 'Content-Type': 'application/json' }, withLlm: true }),
    submit: async (language: string, levelValue: string, score: number) => request<{ success: boolean, score: number, starsEarned: number, isPassed: boolean, nextLevelUnlocked: boolean, nextLevelValue: string | null }>('/api/quiz/submit', { method: 'POST', body: JSON.stringify({ language, levelValue, score }), headers: { 'Content-Type': 'application/json' } }),
  },

  highlights: {
    list: async (bookId?: number) => {
      const queryStr = bookId ? `?bookId=${bookId}` : ''

      return request<Highlight[]>(`/api/highlights${queryStr}`)
    },
    create: async (data: {
      bookId: number
      text: string
      translation?: string | null
      note?: string | null
      color?: string
      chapter?: string | null
      pageNum: number
      analysisData?: LlmAnalysis | null
    }) =>
      request<Highlight>('/api/highlights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }),
    update: async (id: number, data: {
      translation?: string | null
      note?: string | null
      color?: string
      chapter?: string | null
      pageNum?: number
      analysisData?: LlmAnalysis | null
    }) =>
      request<Highlight>(`/api/highlights/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }),
    delete: async (id: number) =>
      request<{ success: boolean }>(`/api/highlights/${id}`, { method: 'DELETE' }),
  },

  plugins: {
    getMyPlugins: async () => request<UserPluginRecord[]>('/api/plugins/my'),
    installPlugin: async (data: { pluginId: string, manifestUrl: string, settings?: string | null, isEnabled?: boolean }) =>
      request<UserPluginRecord>('/api/plugins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }),
    updatePlugin: async (pluginId: string, data: { isEnabled?: boolean, settings?: string | null }) =>
      request<UserPluginRecord>(`/api/plugins/${pluginId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }),
    uninstallPlugin: async (pluginId: string) =>
      request<{ success: boolean }>(`/api/plugins/${pluginId}`, { method: 'DELETE' }),
  },

  catalogPlugins: {
    getApproved: async () => request<CatalogPluginRecord[]>('/api/catalog/plugins'),
    getMy: async () => request<CatalogPluginRecord[]>('/api/catalog/plugins/my'),
    getPending: async () => request<CatalogPluginRecord[]>('/api/catalog/plugins/pending'),
    upload: async (file: File) => {
      const fd = new FormData()
      fd.append('file', file)

      return request<CatalogPluginRecord>('/api/catalog/plugins/upload', {
        method: 'POST',
        body: fd,
      })
    },
    updateStatus: async (id: number, status: 'approved' | 'rejected') =>
      request<CatalogPluginRecord>(`/api/catalog/plugins/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      }),
    delete: async (id: number) =>
      request<{ success: boolean }>(`/api/catalog/plugins/${id}`, { method: 'DELETE' }),
  },
}
