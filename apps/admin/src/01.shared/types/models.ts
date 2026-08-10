export interface AdminUser {
  id: number
  username: string
  role: string
}

export interface UserRow {
  id: number
  username: string
  role: string
  email: string | null
  subscriptionTier: string
  tokenLimit: number
  bookLimit: number
  usedTokens: number
  createdAt: string
  avatarUrl: string | null
}

export interface UserDetail extends UserRow {
  usedBooks: number
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  limit: number
}

export interface DashboardStats {
  totalUsers: number
  totalBooks: number
  pendingPlugins: number
  pendingBooks: number
}

export interface PendingBook {
  id: number
  title: string
  author: string | null
  language: string
  createdAt: string
  user: { id: number, username: string } | null
}

export interface PendingPlugin {
  id: string
  name: string
  version: string
  description: string | null
  author: string | null
  manifestUrl: string
  uploadedBy: number | null
  createdAt: string
}

export interface LoginResponse {
  token: string
  user: AdminUser
}

export interface SubscriptionTier {
  id: string
  name: string
  tokenLimit: number
  bookLimit: number
}

export interface MeResponse {
  user: AdminUser | null
}
