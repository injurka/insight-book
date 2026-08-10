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
  tokenLimit: number | null
  bookLimit: number | null
  usedTokens: number
  createdAt: string
  avatarUrl: string | null
}

export interface UserDetail extends UserRow {
  usedBooks: number
}
