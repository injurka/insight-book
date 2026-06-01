import type { Book, BookStats, DictDeck, GeneratedWordExamples, LlmAnalysis, PagePayload, TocItem, UserDictItem } from '../types/models'
import { getActivePinia } from 'pinia'
import { useGlobalSettingsStore } from '../store/settings.store'

const BASE = import.meta.env.VITE_API_URL || 'https://insight-api.trip-scheduler.ru'

async function request<T>(url: string, opts?: RequestInit): Promise<T> {
  const headers = new Headers(opts?.headers)

  const token = localStorage.getItem('insight_token')
  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  if (getActivePinia()) {
    const settings = useGlobalSettingsStore()
    if (settings.useCustomLlm && settings.customLlmUrl && settings.customLlmModel) {
      headers.set('X-Custom-Llm-Url', settings.customLlmUrl)
      headers.set('X-Custom-Llm-Key', settings.customLlmKey || '')
      headers.set('X-Custom-Llm-Model', settings.customLlmModel)
    }
  }

  const res = await fetch(`${BASE}${url}`, { ...opts, headers })
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
  },
  books: {
    list: () => request<Book[]>('/api/books'),

    getInfo: (id: number) => request<Book>(`/api/books/${id}/info`),

    updateInfo: (id: number, data: Partial<Book>) =>
      request<{ success: boolean }>(`/api/books/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }),

    analyzeBook: (id: number) => request<{ success: boolean, stats: Book['stats'] }>(`/api/books/${id}/analyze-book`, { method: 'POST' }),

    analyzeVocabulary: (id: number) => request<{ success: boolean, lexicalStats: any }>(`/api/books/${id}/analyze-vocabulary`, { method: 'POST' }),

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

    delete: (id: number) => request<{ success: boolean }>(`/api/books/${id}`, { method: 'DELETE' }),

    getToc: (bookId: number) => request<TocItem[]>(`/api/books/${bookId}/toc`),

    getPage: (bookId: number, page: number) =>
      request<PagePayload>(`/api/books/${bookId}/page/${page}`),

    lookupWord: (bookId: number, word: string, signal?: AbortSignal) =>
      request<{ transcription: string, translation: string, isUserDict?: boolean }>(`/api/books/${bookId}/word/${encodeURIComponent(word)}`, { signal }),

    analyze: (bookId: number, sentence: string, language: string, signal?: AbortSignal) =>
      request<LlmAnalysis>(`/api/books/${bookId}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sentence, language }),
        signal,
      }),

    generateTts: (bookId: number, text: string, signal?: AbortSignal) =>
      request<{ audioBase64: string, timings?: any[] }>(`/api/books/${bookId}/tts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
        signal,
      }),

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

    getReviewQueue: (opts: { lang: string, mode: 'srs' | 'random', deckId?: number | 'none' | 'all', difficulty?: string }) => {
      const q = new URLSearchParams()
      q.set('lang', opts.lang)
      q.set('mode', opts.mode)
      if (opts.deckId !== undefined && opts.deckId !== 'all') q.set('deckId', String(opts.deckId))
      if (opts.difficulty && opts.difficulty !== 'all') q.set('difficulty', opts.difficulty)
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
      }),
  },

  activity: {
    getHeatmap: () => request<{ date: string, count: number }[]>('/api/activity/heatmap'),
  },
}
