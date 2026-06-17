import type { Book, BookStats, DictDeck, GeneratedWordExamples, LlmAnalysis, OpdsCatalog, OpdsFeed, PageDictEntry, PagePayload, TocItem, UserDictItem, WordAutoFillResponse } from '../types/models'
import { getActivePinia } from 'pinia'
import { useGlobalSettingsStore } from '../store/settings.store'

export const BASE_API_URL = import.meta.env.VITE_API_URL || 'https://insight-api.trip-scheduler.ru'

interface ApiRequestInit extends RequestInit {
  withLlm?: boolean
}

async function request<T>(url: string, opts?: ApiRequestInit): Promise<T> {
  const headers = new Headers(opts?.headers)

  const token = localStorage.getItem('insight_token')
  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  if (getActivePinia()) {
    const settings = useGlobalSettingsStore()

    if (settings.appLanguage) {
      headers.set('Accept-Language', settings.appLanguage)
    }

    if (opts?.withLlm && settings.useCustomLlm && settings.customLlmUrl && settings.customLlmModel) {
      headers.set('X-Custom-Llm-Url', settings.customLlmUrl)
      headers.set('X-Custom-Llm-Key', settings.customLlmKey || '')
      headers.set('X-Custom-Llm-Model', settings.customLlmModel)
    }
  }
  else {
    try {
      const savedLang = localStorage.getItem('global-app-language')

      if (savedLang) {
        headers.set('Accept-Language', JSON.parse(savedLang))
      }
    }
    catch { }
  }

  const { withLlm, ...fetchOpts } = opts || {}
  const res = await fetch(`${BASE_API_URL}${url}`, { ...fetchOpts, headers })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText })) as { error: string }
    throw new Error(err.error || `HTTP ${res.status}`)
  }
  return res.json() as Promise<T>
}

export const api = {
  auth: {
    login: (data: any) => request<{ token: string, user: any }>('/api/auth/login', { method: 'POST', body: JSON.stringify(data) }),
    me: () => request<{ user: any, mode: string }>('/api/auth/me'),
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

    analyzeVocabulary: (id: number) => request<{ success: boolean, lexicalStats: any }>(`/api/books/${id}/analyze-vocabulary`, { method: 'POST', withLlm: true }),

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
      request<{ transcription: string, translation: string, isUserDict?: boolean }>(`/api/books/${bookId}/word/${encodeURIComponent(word)}`, { signal }),

    checkCache: (bookId: number, items: string[], language: string, signal?: AbortSignal) =>
      request<{ results: { sentence: string, analysis: LlmAnalysis }[] }>(`/api/books/${bookId}/cache-check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items, language }),
        signal,
      }),

    analyzeBatch: (bookId: number, items: { id: string, sentence: string, context?: string }[], language: string, signal?: AbortSignal) => {
      let targetLanguage = 'ru'

      if (getActivePinia()) {
        targetLanguage = useGlobalSettingsStore().appLanguage || 'ru'
      }
      else {
        try {
          const savedLang = localStorage.getItem('global-app-language')
          if (savedLang)
            targetLanguage = JSON.parse(savedLang)
        }
        catch { }
      }

      return request<{ results: { id: string, analysis: LlmAnalysis }[] }>(`/api/books/${bookId}/analyze-batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items, language, targetLanguage }),
        signal,
        withLlm: true,
      })
    },

    analyze: (bookId: number, sentence: string, language: string, context?: string, signal?: AbortSignal) => {
      let targetLanguage = 'ru'
      if (getActivePinia()) {
        targetLanguage = useGlobalSettingsStore().appLanguage || 'ru'
      }
      else {
        try {
          const savedLang = localStorage.getItem('global-app-language')

          if (savedLang)
            targetLanguage = JSON.parse(savedLang)
        }
        catch { }
      }
      return request<LlmAnalysis>(`/api/books/${bookId}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sentence, language, context, targetLanguage }),
        signal,
        withLlm: true,
      })
    },

    generateTts: (bookId: number, text: string, signal?: AbortSignal) =>
      request<{ audioBase64: string, timings?: any[] }>(`/api/books/${bookId}/tts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
        signal,
      }),

    fetchImageBlob: async (path: string) => {
      const url = path.startsWith('http') ? path : `${BASE_API_URL}${path}`
      const headers = new Headers()
      const token = localStorage.getItem('insight_token')
      if (token)
        headers.set('Authorization', `Bearer ${token}`)

      const res = await fetch(url, { headers })
      if (!res.ok)
        throw new Error(`Failed to fetch image: ${res.statusText}`)
      return res.blob()
    },
  },

  tts: {
    generate: (text: string, language: string, signal?: AbortSignal) =>
      request<{ audioBase64: string }>(`/api/tts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, language }),
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
    deleteDeck: (id: number) =>
      request<{ success: boolean }>(`/api/dictionary/decks/${id}`, { method: 'DELETE' }),

    get: (word: string) => request<UserDictItem>(`/api/dictionary/${encodeURIComponent(word)}`),
    upsert: (item: Partial<UserDictItem> & { contextSentence?: string, contextBookId?: number }) =>
      request<{ success: boolean }>('/api/dictionary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item),
      }),
    remove: (word: string) =>
      request<{ success: boolean }>(`/api/dictionary/${encodeURIComponent(word)}`, { method: 'DELETE' }),

    getReviewQueue: (opts: { lang: string, mode: 'srs' | 'random' | 'deep_dive', deckId?: number | 'none' | 'all', difficulty?: string }) => {
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
    bulkMove: (wordIds: number[], deckId: number | null) => request<{ success: boolean }>('/api/dictionary/bulk/move', { method: 'POST', body: JSON.stringify({ wordIds, deckId }) }),

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
      request<any>('/api/dictionary/deep-dive', {
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
  },

  activity: {
    getHeatmap: () => request<{ date: string, count: number }[]>('/api/activity/heatmap'),
    getTokens: () => request<{ stats: { action: string, model: string, inputTokens: number, outputTokens: number, cost?: number }[], daily: { date: string, inputTokens: number, outputTokens: number, cost?: number }[], totalCost: number }>('/api/activity/tokens'),
  },

  opds: {
    getCatalogs: () => request<OpdsCatalog[]>('/api/opds/catalogs'),
    addCatalog: (data: { title: string, url: string }) => request<OpdsCatalog>('/api/opds/catalogs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }),
    deleteCatalog: (id: number) => request<{ success: boolean }>(`/api/opds/catalogs/${id}`, { method: 'DELETE' }),
    browse: (url: string) => request<OpdsFeed>(`/api/opds/browse?url=${encodeURIComponent(url)}`),
    download: (data: { downloadUrl: string, title: string, type?: string }) => request<{ success: boolean, book: Book }>('/api/opds/download', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }),
  },
}
