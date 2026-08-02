import type { Book, BookStats, TocItem } from '~/01.shared/types/models'

export class BookEntity implements Book {
  id!: number
  title!: string
  author!: string | null
  coverUrl!: string | null
  localCoverUrl?: string
  filePath!: string
  language!: string
  totalPages!: number
  currentPage!: number | null
  createdAt!: string
  updatedAt?: string
  userId?: number
  type?: string
  toc?: TocItem[]
  stats?: BookStats | null
  series?: string | null
  seriesNumber?: number | null
  status?: string
  isFavorite?: boolean
  collection?: string | null
  isPublic?: boolean
  publicStatus?: 'private' | 'pending' | 'public' | 'rejected'
  textDirection?: string | null
  progressUpdatedAt?: string | null
  analysesCount?: number
  cachedSentences?: number
  cachedWords?: number
  cachedTts?: number
  processStatus?: 'processing' | 'ready' | 'error'
  processError?: string | null

  constructor(data: Book) {
    Object.assign(this, data)
  }

  /**
   * Calculates the reading progress as a percentage.
   */
  getProgressPercent(): number {
    if (!this.currentPage || !this.totalPages || this.totalPages === 0)
      return 0

    return Math.min(100, Math.max(0, Math.round((this.currentPage / this.totalPages) * 100)))
  }

  /**
   * Checks if the book is completed.
   */
  isCompleted(): boolean {
    return this.getProgressPercent() === 100
  }

  /**
   * Checks if there's a previous page.
   */
  hasPrevPage(): boolean {
    return (this.currentPage || 1) > 1
  }

  /**
   * Checks if there's a next page.
   */
  hasNextPage(): boolean {
    return (this.currentPage || 1) < (this.totalPages || 1)
  }
}
