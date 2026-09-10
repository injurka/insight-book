export interface PendingBook {
  id: number
  title: string
  author: string | null
  language: string
  createdAt: string
  user: { id: number, username: string } | null
}

export interface PublicBook {
  id: number
  title: string
  author: string | null
  language: string
  type: string
  totalPages: number
  coverUrl: string | null
  createdAt: string
  user: { id: number, username: string } | null
}
