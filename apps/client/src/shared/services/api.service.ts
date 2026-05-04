import type { Book, GeminiAnalysis, PagePayload, TocItem, UserDictItem } from '../types/models'

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:4445'

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
