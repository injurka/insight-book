import type { Highlight } from '~/components/05.modules/reader/store/highlights.store'
import type { LlmAnalysis } from '~/shared/types/models'
import { api } from '~/shared/services/api.service'
import { offlineService } from '~/shared/services/offline.service'

export interface IHighlightsRepository {
  list: (bookId?: number) => Promise<Highlight[]>
  create: (data: {
    bookId: number
    text: string
    color: string
    pageNum: number
    chapter?: string | null
    translation?: string | null
    note?: string | null
    analysisData?: LlmAnalysis | null
  }) => Promise<Highlight>
  update: (id: number, data: any) => Promise<Highlight>
  delete: (id: number) => Promise<{ success: boolean }>
  saveLocalHighlights: (bookId: number, highlights: Highlight[]) => Promise<void>
}

export class DefaultHighlightsRepository implements IHighlightsRepository {
  async list(bookId?: number): Promise<Highlight[]> {
    try {
      const data = await api.highlights.list(bookId) as Highlight[]
      if (bookId) {
        await offlineService.saveHighlights(bookId, data as any).catch(() => {})
      }
      return data
    }
    catch (error) {
      if (bookId) {
        const offlineData = await offlineService.getHighlights(bookId)
        if (offlineData) {
          return (offlineData || []) as Highlight[]
        }
      }
      throw error
    }
  }

  async create(data: Parameters<IHighlightsRepository['create']>[0]): Promise<Highlight> {
    return await api.highlights.create(data) as any
  }

  async update(id: number, data: any): Promise<Highlight> {
    return await api.highlights.update(id, data) as any
  }

  async delete(id: number): Promise<{ success: boolean }> {
    return await api.highlights.delete(id)
  }

  async saveLocalHighlights(bookId: number, highlights: Highlight[]) {
    await offlineService.saveHighlights(bookId, highlights as any)
  }
}

export const highlightsRepository: IHighlightsRepository = new DefaultHighlightsRepository()
