import type { Book, BookStats, GeminiAnalysis, PagePayload, TocItem, UserDictItem } from '../types/models'

const BASE = import.meta.env.VITE_API_URL || 'https://insight-api.trip-scheduler.ru'

async function request<T>(url: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${url}`, opts)
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText })) as { error: string }
    throw new Error(err.error || `HTTP ${res.status}`)
  }
  return res.json() as Promise<T>
}

export const api = {
  books: {
    list: () => request<Book[]>('/api/books'),

    getInfo: (id: number) => request<Book>(`/api/books/${id}/info`),

    analyzeBook: (id: number) => request<{ success: boolean, stats: Book['stats'] }>(`/api/books/${id}/analyze-book`, { method: 'POST' }),

    updateCover: (id: number, file: File) => {
      const fd = new FormData()
      fd.append('file', file)
      return request<{ success: boolean, coverBase64: string }>(`/api/books/${id}/cover`, {
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

    lookupWord: (bookId: number, word: string) =>
      request<{ pinyin: string, translation: string }>(`/api/books/${bookId}/word/${encodeURIComponent(word)}`),

    analyze: (bookId: number, sentence: string) =>
      request<GeminiAnalysis>(`/api/books/${bookId}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sentence }),
      }),
  },

  dictionary: {
    list: () => request<UserDictItem[]>('/api/dictionary'),

    get: (word: string) => request<UserDictItem>(`/api/dictionary/${encodeURIComponent(word)}`),

    upsert: (item: Partial<UserDictItem>) =>
      request<{ success: boolean }>('/api/dictionary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item),
      }),

    remove: (word: string) =>
      request<{ success: boolean }>(`/api/dictionary/${encodeURIComponent(word)}`, { method: 'DELETE' }),
  },
}
