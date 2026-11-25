import type {
  AdminAnalyticsOverview,
  AdminCustomFunnelResponse,
  AdminEventsCleanupResult,
  AdminEventsOverview,
  AdminEventStreamResponse,
  AdminUserDetailedAnalytics,
  AdminUserEventsResponse,
  AdminUserSortBy,
  CatalogPlugin,
  DashboardStats,
  LoginResponse,
  MeResponse,
  PaginatedResponse,
  PendingBook,
  PendingPlugin,
  ProductEventCategory,
  PublicBook,
  SortDirection,
  SubscriptionTier,
  SubscriptionTierInput,
  UserDetail,
  UserLifecycleSegment,
  UserRow,
} from '~/01.shared/types/models'
import { ofetch } from 'ofetch'

import { API_URL } from '~/01.shared/lib/env'

export const BASE_API_URL = API_URL

export function resolveMediaUrl(url?: string | null): string | null {
  if (!url)
    return null

  if (/^(?:https?:|data:|blob:)/i.test(url))
    return url

  const cleanPath = url.startsWith('/') ? url : `/${url}`

  return `${BASE_API_URL.replace(/\/$/, '')}${cleanPath}`
}

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

    createSubscriptionTier: (data: SubscriptionTierInput) =>
      request<SubscriptionTier>('/api/admin/subscription-tiers', {
        method: 'POST',
        body: JSON.stringify(data),
        headers: { 'Content-Type': 'application/json' },
      }),

    updateSubscriptionTier: (id: string, data: SubscriptionTierInput) =>
      request<SubscriptionTier>(`/api/admin/subscription-tiers/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
        headers: { 'Content-Type': 'application/json' },
      }),

    deleteSubscriptionTier: (id: string) =>
      request<{ success: boolean }>(`/api/admin/subscription-tiers/${encodeURIComponent(id)}`, { method: 'DELETE' }),

    stats: () =>
      request<DashboardStats>('/api/admin/stats'),

    analyticsOverview: (days: number = 30) =>
      request<AdminAnalyticsOverview>('/api/admin/analytics/overview', { query: { days } }),

    analyticsEventsOverview: (days: number = 30) =>
      request<AdminEventsOverview>('/api/admin/analytics/events/overview', { query: { days } }),

    analyticsCustomFunnel: (steps: string[], days: number = 30) =>
      request<AdminCustomFunnelResponse>('/api/admin/analytics/events/funnel', {
        query: { steps: steps.join(','), days },
      }),

    listAnalyticsEvents: (opts: {
      page?: number
      limit?: number
      event?: string
      category?: ProductEventCategory | 'all'
      targetUserId?: number
    } = {}) =>
      request<AdminEventStreamResponse>('/api/admin/analytics/events', { query: opts as Record<string, unknown> }),

    cleanupAnalyticsEvents: (retentionDays?: number) =>
      request<AdminEventsCleanupResult>('/api/admin/analytics/events/cleanup', {
        method: 'POST',
        body: JSON.stringify(retentionDays ? { retentionDays } : {}),
        headers: { 'Content-Type': 'application/json' },
      }),

    listUsers: (opts: {
      page?: number
      limit?: number
      search?: string
      segment?: UserLifecycleSegment | 'all'
      sortBy?: AdminUserSortBy
      sortDir?: SortDirection
    } = {}) =>
      request<PaginatedResponse<UserRow>>('/api/admin/users', { query: opts as Record<string, unknown> }),

    getUser: (id: number) =>
      request<UserDetail>(`/api/admin/users/${id}`),

    getUserAnalytics: (id: number) =>
      request<AdminUserDetailedAnalytics>(`/api/admin/users/${id}/analytics`),

    getUserEvents: (id: number, opts: {
      page?: number
      limit?: number
      event?: string
      category?: ProductEventCategory | 'all'
    } = {}) =>
      request<AdminUserEventsResponse>(`/api/admin/users/${id}/events`, { query: opts as Record<string, unknown> }),

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

    publicBooks: (opts: { page?: number, limit?: number, search?: string } = {}) =>
      request<PaginatedResponse<PublicBook>>('/api/admin/books/public', { query: opts as Record<string, unknown> }),

    deleteBook: (id: number) =>
      request<{ success: boolean }>(`/api/admin/books/${id}`, { method: 'DELETE' }),

    setBookStatus: (id: number, status: 'approved' | 'rejected') =>
      request<{ success: boolean }>(`/api/admin/books/${id}/public-status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
        headers: { 'Content-Type': 'application/json' },
      }),

    pendingPlugins: () =>
      request<PendingPlugin[]>('/api/admin/plugins/pending'),

    listPlugins: (status?: string) =>
      request<CatalogPlugin[]>(status ? `/api/admin/plugins?status=${encodeURIComponent(status)}` : '/api/admin/plugins'),

    setPluginStatus: (id: string, version: string, status: 'approved' | 'rejected') =>
      request<Record<string, unknown>>(`/api/admin/plugins/${id}/versions/${version}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
        headers: { 'Content-Type': 'application/json' },
      }),

    deletePlugin: (id: string) =>
      request<{ success: boolean }>(`/api/admin/plugins/${id}`, { method: 'DELETE' }),

    downloadPlugin: (id: string, version: string) =>
      request<Blob, 'blob'>(`/api/admin/plugins/${id}/versions/${version}/download`, {
        responseType: 'blob',
      }),
  },
}
