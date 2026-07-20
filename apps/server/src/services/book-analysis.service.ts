import type { BatchAnalysisRequest, LlmConfig } from '../types'
import { parse as parseHtml } from 'node-html-parser'
import { normalizeLanguageCode } from '~/utils/helpers'
import { bookRepository } from '../repositories/book.repository'
import { AppError } from '../utils/errors'
import { runWorkerTask } from '../workers/worker-client'
import { analyzeBatch, analyzeBookExcerpt, analyzeMangaInfo, analyzeSentence, checkCacheBatch } from './llm.service'

export class BookAnalysisService {
  async analyzeVocabulary(id: number, userId: number) {
    const book = await bookRepository.findFirstBook(id)
    if (!book || book.userId !== userId)
      throw new AppError(403, 'Нет доступа')

    const result = await runWorkerTask<{ posDistribution?: unknown, topWords?: unknown, lexicalDiversity?: number, totalSentences?: number, totalWords?: number }>('analyzeBookVocabulary', { bookId: id, language: normalizeLanguageCode(book.language) })
    await bookRepository.upsertBookStats(id, {
      posDistribution: JSON.stringify((result as { posDistribution?: unknown }).posDistribution),
      topWords: JSON.stringify((result as { topWords?: unknown }).topWords),
      lexicalDiversity: (result as { lexicalDiversity?: number }).lexicalDiversity,
      totalSentences: (result as { totalSentences?: number }).totalSentences,
      totalWords: (result as { totalWords?: number }).totalWords,
    })

    return { success: true, lexicalStats: result }
  }

  async analyzeBookStats(id: number, userId: number, config: LlmConfig) {
    const book = await bookRepository.findFirstBook(id)
    if (!book || book.userId !== userId)
      throw new AppError(403, 'Нет доступа')

    let aiData
    let totalItems = 0
    const uniqueSet = new Set<string>()

    if (book.type === 'manga') {
      aiData = await analyzeMangaInfo(userId, book.title, book.author || '', normalizeLanguageCode(book.language), config)
    }
    else {
      const pages = await bookRepository.getBookPages(id)
      if (!pages.length)
        throw new AppError(400, 'Страницы для анализа не найдены')

      let excerpt = ''
      for (const p of pages) {
        if (excerpt.length >= 3000)
          break
        const plainText = parseHtml(p.content).textContent
        excerpt += `${plainText}\n`
      }
      excerpt = excerpt.substring(0, 3000)

      aiData = await analyzeBookExcerpt(userId, excerpt, config)

      const normLang = normalizeLanguageCode(book.language)
      for (const p of pages) {
        const plainText = parseHtml(p.content).textContent
        if (normLang === 'zh' || normLang === 'ja') {
          const chars = plainText.match(/[\p{L}\p{N}]/gu) || []
          totalItems += chars.length
          for (const c of chars) uniqueSet.add(c)
        }
        else {
          const words = plainText.match(/[\p{L}\p{N}]+/gu) || []
          totalItems += words.length
          for (const w of words) uniqueSet.add(w.toLowerCase())
        }
      }
    }

    const tagsJson = JSON.stringify(aiData.tags || [])
    const descriptionJson = typeof aiData.description === 'string' ? aiData.description : JSON.stringify(aiData.description || {})

    await bookRepository.upsertBookStats(id, {
      description: descriptionJson,
      difficulty: aiData.difficulty,
      tags: tagsJson,
      totalChars: totalItems,
      uniqueChars: uniqueSet.size,
    })

    const newStats = await bookRepository.getBookStats(id)
    return { success: true, stats: newStats ? { ...newStats, tags: newStats.tags ? JSON.parse(newStats.tags) : [], posDistribution: newStats.posDistribution ? JSON.parse(newStats.posDistribution) : null, topWords: newStats.topWords ? JSON.parse(newStats.topWords) : null } : null }
  }

  async checkCache(bookId: number, userId: number, items: { text: string, type: 'sentence' | 'word' }[], language: string, targetLang: string) {
    const book = await bookRepository.getBookUserIdAndPublic(bookId)
    if (!book || (book.userId !== userId && !book.isPublic))
      throw new AppError(403, 'Нет доступа')

    return checkCacheBatch(bookId, items, normalizeLanguageCode(language), targetLang)
  }

  async analyzeSentence(bookId: number, userId: number, sentence: string, language: string, context: string, targetLang: string, type: string, config: LlmConfig) {
    const book = await bookRepository.getBookUserIdAndPublic(bookId)
    if (!book || (book.userId !== userId && !book.isPublic))
      throw new AppError(403, 'Нет доступа')

    return analyzeSentence(userId, bookId, sentence, normalizeLanguageCode(language), targetLang, config, context, type as 'sentence' | 'word')
  }

  async analyzeBatch(bookId: number, userId: number, items: BatchAnalysisRequest[], language: string, targetLang: string, config: LlmConfig) {
    const book = await bookRepository.getBookUserIdAndPublic(bookId)
    if (!book || (book.userId !== userId && !book.isPublic))
      throw new AppError(403, 'Нет доступа')

    return analyzeBatch(userId, bookId, items, normalizeLanguageCode(language), targetLang, config)
  }
}

export const bookAnalysisService = new BookAnalysisService()
