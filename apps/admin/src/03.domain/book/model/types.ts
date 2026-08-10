export interface PendingBook {
  id: number
  title: string
  author: string | null
  language: string
  createdAt: string
  user: { id: number, username: string } | null
}
