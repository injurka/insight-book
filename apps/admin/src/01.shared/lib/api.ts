import type { DashboardStats, LoginResponse, MeResponse, PaginatedResponse, PendingBook, PendingPlugin, SubscriptionTier, UserDetail, UserRow } from '~/01.shared/types/models'
import { ofetch } from 'ofetch'

import { API_URL } from '~/01.shared/lib/env'

export const BASE_API_URL = API_URL

// -- providers (внедряются через configureApi) --

export interface ApiProviders {
  getToken?: () => string | null
  onUnauthorized?: () => void
}

const providers: Required<ApiProviders> = {
  getToken: () => localStorage.getItem('admin_token'),
  onUnauthorized: () => {},
}

export function configureApi(overrides: ApiProviders) {
  Object.assign(providers, overrides)
}

// -- ofetch client --

export const request = ofetch.create({
  baseURL: BASE_API_URL,
  async onRequest({ options }) {
    options.headers = new Headers(options.headers || {})
    const token = providers.getToken()
    if (token)
      options.headers.set('Authorization', `Bearer ${token}`)
  },
  async onResponseError({ response, options }) {
    const msg = response._data?.error || `HTTP ${response.status}`
    const opts = options as unknown as Record<string, unknown>
    if (response.status === 401 && !opts.silentErrors)
      providers.onUnauthorized()
    throw new Error(msg)
  },
})

// -- raw API (используется ТОЛЬКО репозиториями) --

export const api = {
  auth: {
    login: (login: string, password: string) =>
      request<LoginResponse>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ login, password }),
      }),
    me: () =>
      request<MeResponse>('/api/auth/me'),
  },
  admin: {
    getSubscriptionTiers: () =>
      request<SubscriptionTier[]>('/api/admin/subscription-tiers'),

    stats: () =>
      request<DashboardStats>('/api/admin/stats'),

    listUsers: (opts: { page?: number, limit?: number, search?: string } = {}) =>
      request<PaginatedResponse<UserRow>>('/api/admin/users', { query: opts as Record<string, unknown> }),

    getUser: (id: number) =>
      request<UserDetail>(`/api/admin/users/${id}`),

    createUser: (data: {
      username: string
      password: string
      role?: string
      email?: string | null
      subscriptionTier?: string
      tokenLimit?: number
      bookLimit?: number
    }) =>
      request<{ success: boolean, user: Record<string, unknown> }>('/api/admin/users', {
        method: 'POST',
        body: JSON.stringify(data),
        headers: { 'Content-Type': 'application/json' },
      }),

    updateUser: (id: number, data: Record<string, unknown>) =>
      request<{ success: boolean, user: Record<string, unknown> | null }>(`/api/admin/users/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
        headers: { 'Content-Type': 'application/json' },
      }),

    deleteUser: (id: number) =>
      request<{ success: boolean }>(`/api/admin/users/${id}`, { method: 'DELETE' }),

    pendingBooks: () =>
      request<PendingBook[]>('/api/admin/books/pending'),

    setBookStatus: (id: number, status: 'approved' | 'rejected') =>
      request<{ success: boolean }>(`/api/admin/books/${id}/public-status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
        headers: { 'Content-Type': 'application/json' },
      }),

    pendingPlugins: () =>
      request<PendingPlugin[]>('/api/admin/plugins/pending'),

    setPluginStatus: (id: string, status: 'approved' | 'rejected') =>
      request<Record<string, unknown>>(`/api/admin/plugins/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
        headers: { 'Content-Type': 'application/json' },
      }),
  },
}
