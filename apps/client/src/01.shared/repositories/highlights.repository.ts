import type { LlmAnalysis } from '~/01.shared/types/models'
import type { Highlight } from '~/05.modules/reader/store/highlights.store'
import { z } from 'zod'
import { applyAcl } from '~/01.shared/lib/acl'
import { api } from '~/01.shared/services/api.service'
import { offlineService } from '~/01.shared/services/offline.service'
import { HighlightSchema } from '~/01.shared/types/schemas/highlight.schema'

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
      const raw = await api.highlights.list(bookId)
      const data = applyAcl(z.array(HighlightSchema), raw, 'highlights.list()')
      if (bookId) {
        await offlineService.saveHighlights(bookId, data as any).catch(() => {})
      }
      return data
    }
    catch (error) {
      if (bookId) {
        const offlineData = await offlineService.getHighlights(bookId)
        if (offlineData) {
          return applyAcl(z.array(HighlightSchema), offlineData, 'highlights.list() [offline]')
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
