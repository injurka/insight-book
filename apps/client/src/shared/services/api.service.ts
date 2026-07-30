import type { AuthLoginDto, AuthRegisterDto, AuthSendCodeDto, Book, BookStats, CatalogDeck, CatalogPluginRecord, CatalogWord, DictDeck, GeneratedWordExamples, Highlight, LlmAnalysis, PageDictEntry, PagePayload, PromptItem, TocItem, UserData, UserDictItem, UserPluginRecord, WordAutoFillResponse } from '../types/models'
import { ofetch } from 'ofetch'
import { API_URL } from '~/shared/lib/env'

import { i18n } from '../plugins/i18n'

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
    if (token) {
      options.headers.set('Authorization', `Bearer ${token}`)
    }

    const appLanguage = providers.getAppLanguage()
    if (appLanguage) {
      options.query = { ...options.query, targetLang: appLanguage }
    }

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
      if (options.withLlm || errMessage.includes('LLM') || errMessage.includes('AI')) {
        errMessage = i18n.global.t('errors.aiServer') || 'Сервер ИИ временно недоступен'
      }
      else {
        errMessage = i18n.global.t('errors.server500') || 'Внутренняя ошибка сервера'
      }
    }

    if (!options.silentErrors) {
      providers.onError(errMessage)

      if (response.status === 401) {
        providers.onUnauthorized()
      }
    }

    throw new Error(errMessage)
  },
  async onRequestError({ error, options }) {
    let errMessage = error.message
    if (errMessage.includes('Failed to fetch') || errMessage.includes('Network Error')) {
      errMessage = i18n.global.t('errors.network') || 'Проверьте подключение к интернету'
    }

    const isAbort = error.name === 'AbortError' || errMessage.toLowerCase().includes('abort') || errMessage.toLowerCase().includes('cancel')

    if (!options?.silentErrors && !isAbort) {
      providers.onError(errMessage)
    }

    const finalError = new Error(errMessage)
    if (isAbort) {
      finalError.name = 'AbortError'
    }
    throw finalError
  },
})

export const api = {
  auth: {
    login: (data: AuthLoginDto) => request<{ token: string, user: UserData }>('/api/auth/login', { method: 'POST', body: JSON.stringify(data) }),
    sendCode: (data: AuthSendCodeDto) => request<{ success: boolean, message: string }>('/api/auth/send-code', { method: 'POST', body: JSON.stringify(data) }),
    register: (data: AuthRegisterDto) => request<{ token: string, user: UserData }>('/api/auth/register', { method: 'POST', body: JSON.stringify(data) }),
    me: () => request<{ user: UserData | null, mode: string }>('/api/auth/me'),
    updateAvatar: (file: File) => {
      const fd = new FormData()
      fd.append('file', file)
      return request<{ success: boolean, avatarUrl: string }>('/api/auth/me/avatar', {
        method: 'PATCH',
        body: fd,
      })
    },
    updateUsername: (username: string) => request<{ success: boolean, username: string }>('/api/auth/me/username', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username }),
    }),
  },
  books: {
    list: () => request<Book[]>('/api/books'),
    getPublic: (query: string) => request<{ data: Book[], total: number, page: number, limit: number }>(`/api/books?${query}`),

    getInfo: (id: number) => request<Book>(`/api/books/${id}/info`),

    startReading: (id: number) => request<{ success: boolean }>(`/api/books/${id}/start`, { method: 'POST' }),

    updateInfo: (id: number, data: Partial<Book>) =>
      request<{ success: boolean }>(`/api/books/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }),

    analyzeBook: (id: number) => request<{ success: boolean, stats: Book['stats'] }>(`/api/books/${id}/analyze-book`, { method: 'POST', withLlm: true }),

    analyzeVocabulary: (id: number) => request<{ success: boolean, lexicalStats: Pick<BookStats, 'posDistribution' | 'topWords' | 'lexicalDiversity'> }>(`/api/books/${id}/analyze-vocabulary`, { method: 'POST', withLlm: true }),

    updateCover: (id: number, file: File) => {
      const fd = new FormData()
      fd.append('file', file)
      return request<{ success: boolean, coverUrl: string }>(`/api/books/${id}/cover`, {
        method: 'PATCH',
        body: fd,
      })
    },

    updateStats: (id: number, data: Partial<BookStats>) =>
      request<{ success: boolean, stats: BookStats }>(`/api/books/${id}/stats`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }),

    upload: (file: File) => {
      const fd = new FormData()
      fd.append('file', file)
      return request<{ success: boolean, book: Book }>('/api/books/upload', {
        method: 'POST',
        body: fd,
      })
    },

    createCustomBook: (data: { title: string, author?: string | null, language: string, type: string }) =>
      request<{ success: boolean, book: Book }>('/api/books/custom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }),

    appendMangaChapter: (id: number, fd: FormData) =>
      request<{ success: boolean, book: Book }>(`/api/books/${id}/manga-chapter`, {
        method: 'POST',
        body: fd,
      }),

    delete: (id: number) => request<{ success: boolean }>(`/api/books/${id}`, { method: 'DELETE' }),

    getToc: (bookId: number) => request<TocItem[]>(`/api/books/${bookId}/toc`),

    getPage: (bookId: number, page: number, isSync?: boolean) =>
      request<PagePayload>(`/api/books/${bookId}/page/${page}${isSync ? '?sync=true' : ''}`),

    getPageDict: (bookId: number, page: number) =>
      request<{ pageDictionary: Record<string, PageDictEntry> }>(`/api/books/${bookId}/page/${page}/dict`),

    lookupWord: (bookId: number, word: string, signal?: AbortSignal) =>
      request<{ transcription: string, translation: string, isUserDict?: boolean }>(`/api/books/${bookId}/word/${encodeURIComponent(word)}`, { signal, silentErrors: true }),

    checkCache: (
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

    analyzeBatch: (
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

    analyze: (
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

    generateTts: (
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

      const res = await fetch(url, { headers })
      if (!res.ok)
        throw new Error(`Failed to fetch image: ${res.statusText}`)
      return res.blob()
    },
  },

  tts: {
    generate: (
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
    list: () => request<UserDictItem[]>('/api/dictionary'),

    decks: () => request<DictDeck[]>('/api/dictionary/decks'),
    createDeck: (data: { name: string, language: string }) =>
      request<DictDeck>('/api/dictionary/decks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }),
    updateDeck: (id: number, data: { name: string }) =>
      request<{ success: boolean }>(`/api/dictionary/decks/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }),
    deleteDeck: (id: number, mode: 'keep' | 'delete_all' | 'delete_exclusive' = 'keep') =>
      request<{ success: boolean }>(`/api/dictionary/decks/${id}?mode=${mode}`, { method: 'DELETE' }),

    get: (word: string) => request<UserDictItem>(`/api/dictionary/${encodeURIComponent(word)}`, { silentErrors: true }),
    upsert: (item: Partial<UserDictItem> & { contextSentence?: string, contextBookId?: number }) =>
      request<{ success: boolean }>('/api/dictionary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item),
      }),
    remove: (word: string) =>
      request<{ success: boolean }>(`/api/dictionary/${encodeURIComponent(word)}`, { method: 'DELETE' }),

    getReviewQueue: (opts: { lang: string, mode: 'srs' | 'random' | 'deep_dive' | 'cram' | 'match', deckId?: number | 'none' | 'all', difficulty?: string }) => {
      const q = new URLSearchParams()
      q.set('lang', opts.lang)
      q.set('mode', opts.mode)
      if (opts.deckId !== undefined && opts.deckId !== 'all')
        q.set('deckId', String(opts.deckId))
      if (opts.difficulty && opts.difficulty !== 'all')
        q.set('difficulty', opts.difficulty)
      return request<UserDictItem[]>(`/api/dictionary/review?${q.toString()}`)
    },

    submitReview: (wordId: number, grade: number) =>
      request<{ success: boolean }>('/api/dictionary/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wordId, grade }),
      }),

    bulkDelete: (wordIds: number[]) => request<{ success: boolean }>('/api/dictionary/bulk/delete', { method: 'POST', body: JSON.stringify({ wordIds }) }),
    bulkMove: (wordIds: number[], deckIds: number[]) => request<{ success: boolean }>('/api/dictionary/bulk/move', { method: 'POST', body: JSON.stringify({ wordIds, deckIds }) }),

    generateExamples: (word: string, language: string) =>
      request<GeneratedWordExamples>('/api/dictionary/generate-examples', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ word, language }),
        withLlm: true,
      }),

    autoFillWord: (word: string, language: string) =>
      request<WordAutoFillResponse>('/api/dictionary/auto-fill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ word, language }),
        withLlm: true,
      }),

    generateDeepDive: (word: string, language: string, mode: 'collocations' | 'radicals') =>
      request<unknown>('/api/dictionary/deep-dive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ word, language, mode }),
        withLlm: true,
      }),

    checkPronunciation: (word: string, language: string, audioBlob: Blob) => {
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

    importCsv: (data: unknown) => request<{ success: boolean }>('/api/dictionary/import', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }),
    catalog: () => request<CatalogDeck[]>('/api/dictionary/catalog'),
    catalogWords: (id: number) => request<CatalogWord[]>(`/api/dictionary/catalog/${id}/words`),
    cloneCatalog: (id: number) => request<{ success: boolean, deckId: number }>(`/api/dictionary/catalog/${id}/clone`, { method: 'POST' }),
    promptsList: () => request<PromptItem[]>('/api/dictionary/prompts'),
    promptsCreate: (data: { name: string, prompt: string }) => request<PromptItem>('/api/dictionary/prompts', { method: 'POST', body: JSON.stringify(data), headers: { 'Content-Type': 'application/json' } }),
    promptsUpdate: (id: number, data: { name?: string, prompt?: string }) => request<PromptItem>(`/api/dictionary/prompts/${id}`, { method: 'PATCH', body: JSON.stringify(data), headers: { 'Content-Type': 'application/json' } }),
    promptsDelete: (id: number) => request<{ success: boolean }>(`/api/dictionary/prompts/${id}`, { method: 'DELETE' }),
    chat: (data: { word: string, language: string, customPromptId?: number, userPromptText?: string }) => request<{ response: string }>('/api/dictionary/chat', { method: 'POST', body: JSON.stringify(data), headers: { 'Content-Type': 'application/json' }, withLlm: true }),
  },

  activity: {
    getStats: () => request<{ heatmap: { date: string, count: number }[], learnedWords: number, readPages: number, difficulties: { language: string, difficulty: string, count: number }[], quizProgress?: { language: string, levelValue: string, bestScore: number, stars: number, unlocked: boolean }[] }>('/api/activity/stats'),
    getTokens: (period?: string) => request<{ stats: { action: string, inputTokens: number, outputTokens: number, cost: number }[], daily: { date: string, inputTokens: number, outputTokens: number, cost?: number }[], totalCost: number }>(`/api/activity/tokens${period ? `?period=${period}` : ''}`),
  },

  quiz: {
    getLevels: (language: string) => request<{ id: number, language: string, levelValue: string, bestScore: number, stars: number, unlocked: boolean }[]>(`/api/quiz/levels?language=${language}`),
    generate: (language: string, levelValue: string) => request<{ questions: { type: 'choice' | 'cloze' | 'reorder', question: string, options: string[], correctAnswer: string, explanation: string }[], cached: boolean }>('/api/quiz/generate', { method: 'POST', body: JSON.stringify({ language, levelValue }), headers: { 'Content-Type': 'application/json' }, withLlm: true }),
    submit: (language: string, levelValue: string, score: number) => request<{ success: boolean, score: number, starsEarned: number, isPassed: boolean, nextLevelUnlocked: boolean, nextLevelValue: string | null }>('/api/quiz/submit', { method: 'POST', body: JSON.stringify({ language, levelValue, score }), headers: { 'Content-Type': 'application/json' } }),
  },

  highlights: {
    list: (bookId?: number) => {
      const q = bookId ? `?bookId=${bookId}` : ''
      return request<Highlight[]>(`/api/highlights${q}`)
    },
    create: (data: {
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
    update: (id: number, data: {
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
    delete: (id: number) =>
      request<{ success: boolean }>(`/api/highlights/${id}`, { method: 'DELETE' }),
  },

  plugins: {
    getMyPlugins: () => request<UserPluginRecord[]>('/api/plugins/my'),
    installPlugin: (data: { pluginId: string, manifestUrl: string, settings?: string | null, isEnabled?: boolean }) =>
      request<UserPluginRecord>('/api/plugins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }),
    updatePlugin: (pluginId: string, data: { isEnabled?: boolean, settings?: string | null }) =>
      request<UserPluginRecord>(`/api/plugins/${pluginId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }),
    uninstallPlugin: (pluginId: string) =>
      request<{ success: boolean }>(`/api/plugins/${pluginId}`, { method: 'DELETE' }),
  },

  catalogPlugins: {
    getApproved: () => request<CatalogPluginRecord[]>('/api/catalog/plugins'),
    getMy: () => request<CatalogPluginRecord[]>('/api/catalog/plugins/my'),
    getPending: () => request<CatalogPluginRecord[]>('/api/catalog/plugins/pending'),
    upload: (file: File) => {
      const fd = new FormData()
      fd.append('file', file)
      return request<CatalogPluginRecord>('/api/catalog/plugins/upload', {
        method: 'POST',
        body: fd,
      })
    },
    updateStatus: (id: number, status: 'approved' | 'rejected') =>
      request<CatalogPluginRecord>(`/api/catalog/plugins/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      }),
    delete: (id: number) =>
      request<{ success: boolean }>(`/api/catalog/plugins/${id}`, { method: 'DELETE' }),
  },
}
