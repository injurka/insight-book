import type { IHighlightRepository } from '../repositories/interfaces'
import type { LlmAnalysis } from '../types'
import { ERROR_CODES } from '../constants/error-codes'
import { highlightRepository } from '../repositories/highlight.repository'
import { AppError } from '../utils/errors'

export class HighlightService {
  constructor(private highlightRepo: IHighlightRepository = highlightRepository) {}
  async getHighlights(userId: number, bookId?: number) {
    return this.highlightRepo.findMany(userId, bookId)
  }

  async createHighlight(
    userId: number,
    body: {
      bookId: number
      text: string
      translation?: string | null
      note?: string | null
      color?: string | null
      chapter?: string | null
      pageNum: number
      analysisData?: LlmAnalysis | null
    },
  ) {
    return this.highlightRepo.create({
      userId,
      bookId: body.bookId,
      text: body.text,
      translation: body.translation,
      note: body.note,
      color: body.color ?? undefined,
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
      color?: string | null
      chapter?: string | null
      pageNum?: number
      analysisData?: LlmAnalysis | null
    },
  ) {
    const updated = await this.highlightRepo.update(id, userId, {
      ...body,
      color: body.color ?? undefined,
    })
    if (!updated) {
      throw new AppError(404, ERROR_CODES.HIGHLIGHT.NOT_FOUND, 'Highlight not found')
    }
    return updated
  }

  async deleteHighlight(id: number, userId: number) {
    const isDeleted = await this.highlightRepo.delete(id, userId)
    if (!isDeleted) {
      throw new AppError(404, ERROR_CODES.HIGHLIGHT.NOT_FOUND, 'Highlight not found')
    }
    return { success: true }
  }
}

export const highlightService = new HighlightService()
