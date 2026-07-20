import { highlightRepository } from '../repositories/highlight.repository'
import { AppError } from '../utils/errors'

export class HighlightService {
  async getHighlights(userId: number, bookId?: number) {
    return highlightRepository.findMany(userId, bookId)
  }

  async createHighlight(
    userId: number,
    body: {
      bookId: number
      text: string
      translation?: string | null
      note?: string | null
      color?: string
      chapter?: string | null
      pageNum: number
      analysisData?: string | null
    },
  ) {
    return highlightRepository.create({
      userId,
      bookId: body.bookId,
      text: body.text,
      translation: body.translation,
      note: body.note,
      color: body.color,
      chapter: body.chapter,
      pageNum: body.pageNum,
      analysisData: body.analysisData,
    })
  }

  async updateHighlight(
    id: number,
    userId: number,
    body: {
      text?: string
      translation?: string | null
      note?: string | null
      color?: string
      chapter?: string | null
      pageNum?: number
      analysisData?: string | null
    },
  ) {
    const updated = await highlightRepository.update(id, userId, body)
    if (!updated) {
      throw new AppError(404, 'Выделение не найдено или доступ закрыт')
    }
    return updated
  }

  async deleteHighlight(id: number, userId: number) {
    const isDeleted = await highlightRepository.delete(id, userId)
    if (!isDeleted) {
      throw new AppError(404, 'Выделение не найдено или доступ закрыт')
    }
    return { success: true }
  }
}

export const highlightService = new HighlightService()
