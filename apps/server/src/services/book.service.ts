import type { IBookRepository } from '../repositories/interfaces'
import type { LlmConfig, PagePayload } from '../types'
import path from 'node:path'

import sharp from 'sharp'
import { decompressData } from '~/utils/compression'
import { extractUniqueWordsFromHtml, normalizeLanguageCode } from '~/utils/helpers'
import { bookRepository } from '../repositories/book.repository'
import { AppError } from '../utils/errors'
import { logger } from '../utils/logger'
import { runWorkerTask } from '../workers/worker-client'
import { activityService } from './activity.service'
import { dictionaryService } from './dictionary.service'
import { generateTts } from './llm.service'
import { recognizeMangaPage } from './ocr.service'
import { storageService } from './storage.service'

export class BookService {
  constructor(private bookRepo: IBookRepository = bookRepository) {}
  async getPublicBooks(page: number, limit: number, tag: string | null, search: string | null, language: string | null, targetLang: string, _userId: number | null) {
    const conditions = this.bookRepo.buildPublicConditions(tag, search, language)
    const total = await this.bookRepo.countPublicBooks(conditions)
    const rows = await this.bookRepo.getPublicBooksBaseQuery(page, limit, conditions)

    const bookIds = rows.map((r: { book: { id: number } }) => r.book.id)
    const llmCounts = await this.bookRepo.getLlmCounts(bookIds, targetLang)
    const countMap = new Map(llmCounts.map((r: { bookId: number, count: number }) => [r.bookId, r.count]))

    const data = rows.map((r: { book: { id: number, [key: string]: unknown }, progress?: { currentPage?: number | null, status?: string | null, isFavorite?: boolean | null, collection?: string | null, updatedAt?: string | null } | null }) => ({
      ...r.book,
      currentPage: r.progress?.currentPage ?? null,
      status: r.progress?.status ?? 'reading',
      isFavorite: r.progress?.isFavorite ?? false,
      collection: r.progress?.collection ?? null,
      progressUpdatedAt: r.progress?.updatedAt ?? null,
      analysesCount: countMap.get(r.book.id) || 0,
    }))

    return { data, total, page, limit }
  }

  async getUserBooks(userId: number, targetLang: string) {
    const allBooks = await this.bookRepo.getUserBooks(userId)
    const result = allBooks
      .filter((b: { userId: number | null, progresses: { currentPage?: number, status?: string, isFavorite?: boolean, collection?: string | null, updatedAt?: string }[] }) => b.userId === userId || b.progresses.length > 0)
      .map((book: { id: number, updatedAt: string, progresses: { currentPage?: number, status?: string, isFavorite?: boolean, collection?: string | null, updatedAt?: string }[], [key: string]: unknown }) => {
        const progress = book.progresses[0]
        const { progresses, ...bookData } = book
        return {
          ...bookData,
          currentPage: progress?.currentPage ?? null,
          status: progress?.status ?? 'reading',
          isFavorite: progress?.isFavorite ?? false,
          collection: progress?.collection ?? null,
          progressUpdatedAt: progress?.updatedAt ?? null,
        }
      })

    const bookIds = result.map(b => b.id)
    const llmCounts = await this.bookRepo.getLlmCounts(bookIds, targetLang)
    const countMap = new Map(llmCounts.map(r => [r.bookId, r.count]))

    const finalResult = result.map(b => ({
      ...b,
      analysesCount: countMap.get(b.id) || 0,
    }))

    finalResult.sort((a, b) => {
      const tA = new Date(a.progressUpdatedAt || a.updatedAt).getTime()
      const tB = new Date(b.progressUpdatedAt || b.updatedAt).getTime()
      return tB - tA
    })

    return finalResult
  }

  async getBookInfo(id: number, userId: number | null, targetLang: string) {
    const book = await this.bookRepo.getBookById(id, userId)
    if (!book)
      throw new AppError(404, 'Книга не найдена или доступ закрыт')

    const progress = book.progresses ? book.progresses[0] : null
    const { progresses, stats, ...bookData } = book
    const statsResult = stats
      ? {
          ...stats,
          tags: stats.tags ? JSON.parse(stats.tags) : [],
          posDistribution: stats.posDistribution ? JSON.parse(stats.posDistribution) : null,
          topWords: stats.topWords ? JSON.parse(stats.topWords) : null,
        }
      : null

    const counts = await this.bookRepo.getBookAnalysesCounts(id, targetLang)
    let analysesCount = (counts.sentencesCountRes?.count || 0) + (counts.wordsCountRes?.count || 0)

    if (book.type === 'manga') {
      const analyzedPagesRes = await this.bookRepo.getMangaPagesCount(id)
      analysesCount = analyzedPagesRes?.count || 0
    }

    return {
      ...bookData,
      currentPage: progress?.currentPage ?? null,
      status: progress?.status ?? 'reading',
      isFavorite: progress?.isFavorite ?? false,
      collection: progress?.collection ?? null,
      toc: book.toc ? JSON.parse(book.toc) : [],
      stats: statsResult,
      analysesCount,
      cachedSentences: counts.sentencesCountRes?.count || 0,
      cachedWords: counts.wordsCountRes?.count || 0,
      cachedTts: counts.ttsCountRes?.count || 0,
    }
  }

  async startReading(id: number, userId: number) {
    const book = await this.bookRepo.findFirstBook(id)
    if (!book)
      throw new AppError(404, 'Книга не найдена')
    if (!book.isPublic && book.userId !== userId)
      throw new AppError(403, 'Нет доступа')

    await this.bookRepo.startReadingProgress(id, userId)
    return { success: true }
  }

  async updateBook(id: number, userId: number, body: Record<string, unknown>) {
    const book = await this.bookRepo.findFirstBook(id)
    if (!book)
      throw new AppError(404, 'Книга не найдена')
    if (book.userId !== userId && !book.isPublic)
      throw new AppError(404, 'Книга не найдена или доступ закрыт')

    const metadataKeys = ['title', 'author', 'coverUrl', 'language', 'series', 'seriesNumber', 'createdAt', 'isPublic', 'publicStatus', 'textDirection'] as const
    const hasMetadataChanges = metadataKeys.some((key) => {
      if (body[key] === undefined)
        return false
      if (key === 'language' && body.language)
        return normalizeLanguageCode(body.language as string) !== book.language
      return body[key] !== (book as Record<string, unknown>)[key]
    })
    const isReadOnly = book.isPublic || book.publicStatus === 'public'

    if (hasMetadataChanges && isReadOnly)
      throw new AppError(403, 'Публичные книги нельзя редактировать')

    if (hasMetadataChanges && book.userId === userId) {
      await this.bookRepo.updateBook(id, {
        title: body.title as string | undefined,
        author: body.author as string | null | undefined,
        coverUrl: body.coverUrl as string | null | undefined,
        language: body.language ? normalizeLanguageCode(body.language as string) : undefined,
        series: body.series as string | null | undefined,
        seriesNumber: body.seriesNumber as number | null | undefined,
        createdAt: body.createdAt as string | undefined,
        isPublic: body.isPublic as boolean | undefined,
        publicStatus: body.publicStatus as string | undefined,
        textDirection: body.textDirection as string | null | undefined,
        updatedAt: new Date().toISOString(),
      })
    }

    const progressKeys = ['currentPage', 'status', 'isFavorite', 'collection']
    const hasProgressChanges = progressKeys.some(key => body[key] !== undefined)

    if (hasProgressChanges) {
      await this.bookRepo.upsertReadingProgress(id, userId, body)
    }

    return { success: true }
  }

  async updateCover(id: number, userId: number, file: File) {
    const oldBook = await this.bookRepo.getOldBookForCover(id)
    if (!oldBook || oldBook.userId !== userId)
      throw new AppError(403, 'Нет доступа')

    const buffer = await file.arrayBuffer()
    const ext = path.extname(file.name).toLowerCase() || '.jpg'
    const filename = `${Date.now()}_cover${ext}`

    await storageService.uploadFile(`covers/${filename}`, buffer, `image/${ext.slice(1)}`)
    const coverUrl = `/api/uploads/covers/${filename}`

    await this.bookRepo.updateCoverUrl(id, coverUrl)

    if (oldBook.coverUrl && oldBook.coverUrl.startsWith('/api/uploads/covers/')) {
      const oldFile = oldBook.coverUrl.split('/').pop()!
      await storageService.deleteFile(`covers/${oldFile}`)
    }

    return { success: true, coverUrl }
  }

  async updateStats(id: number, userId: number, body: { difficulty?: string, description?: string, tags?: string[] }) {
    const book = await this.bookRepo.findFirstBook(id)
    if (!book || book.userId !== userId)
      throw new AppError(403, 'Нет доступа')

    const tagsJson = JSON.stringify(body.tags || [])
    await this.bookRepo.upsertBookStats(id, { description: body.description || '', difficulty: body.difficulty || '', tags: tagsJson })

    const stats = await this.bookRepo.getBookStats(id)
    return { success: true, stats: stats ? { ...stats, tags: stats.tags ? JSON.parse(stats.tags) : [], posDistribution: stats.posDistribution ? JSON.parse(stats.posDistribution) : null, topWords: stats.topWords ? JSON.parse(stats.topWords) : null } : null }
  }

  async deleteBook(id: number, userId: number) {
    const book = await this.bookRepo.getBookForDeletion(id)
    if (!book)
      throw new AppError(404, 'Книга не найдена')

    if (book.userId !== userId) {
      await this.bookRepo.deleteReadingProgress(id, userId)
      return { success: true }
    }

    if (book.isPublic || book.publicStatus === 'public') {
      throw new AppError(403, 'Публичные книги нельзя удалить')
    }

    await this.bookRepo.deleteBook(id)

    try {
      if (book.filePath) {
        const folderName = path.basename(book.filePath)
        await storageService.deleteFolder(`books/${folderName}`)
      }
      if (book.coverUrl && book.coverUrl.startsWith('/api/uploads/covers/')) {
        const coverFilename = book.coverUrl.split('/').pop()!
        await storageService.deleteFile(`covers/${coverFilename}`)
      }
    }
    catch (err: unknown) {
      logger.warn(err as Error, `[File Delete Warning] Не удалось удалить файлы книги:`)
    }

    return { success: true }
  }

  async getToc(id: number, userId: number) {
    const book = await this.bookRepo.getBookToc(id)
    if (!book || (book.userId !== userId && !book.isPublic))
      throw new AppError(403, 'Нет доступа к книге')
    return book.toc ? JSON.parse(book.toc) : []
  }

  async getPage(bookId: number, pageNum: number, userId: number, isSync: boolean, config: LlmConfig) {
    const book = await this.bookRepo.getBookForPage(bookId)
    if (!book)
      throw new AppError(404, 'Книга не найдена')

    const bookLang = normalizeLanguageCode(book.language)
    if (book.userId !== userId && !book.isPublic)
      throw new AppError(403, 'Нет доступа к книге')

    if (!isSync) {
      await this.bookRepo.upsertReadingProgress(bookId, userId, { currentPage: pageNum })
      await activityService.trackActivity(userId, 'wordsAdded', 1)
    }

    if (book.type === 'manga') {
      const pageRow = await this.bookRepo.getMangaPage(bookId, pageNum)
      if (!pageRow)
        throw new AppError(404, 'Страница манги не найдена')

      let ocrBlocks = pageRow.ocrData ? JSON.parse(pageRow.ocrData) : null

      if (ocrBlocks === null && pageRow.imageUrl) {
        try {
          const fileData = await storageService.getFile(pageRow.imageUrl)
          if (!fileData)
            throw new Error('File not found')
          const fileBuffer = Buffer.from(fileData.buffer)
          let base64 = ''

          const ext = path.extname(pageRow.imageUrl).toLowerCase()
          const isSupportedOCR = ['.jpg', '.jpeg', '.png', '.pdf'].includes(ext)
          const isTooLarge = fileBuffer.byteLength > 9.5 * 1024 * 1024

          if (!isSupportedOCR || isTooLarge) {
            const optimizedBuffer = await sharp(fileBuffer)
              .resize({ width: 3000, height: 4000, fit: 'inside', withoutEnlargement: true })
              .jpeg({ quality: 80 })
              .toBuffer()
            base64 = optimizedBuffer.toString('base64')
          }
          else {
            base64 = fileBuffer.toString('base64')
          }

          ocrBlocks = await recognizeMangaPage(userId, base64, bookLang, book.textDirection || undefined, config)
          await this.bookRepo.updateMangaPageOcr(pageRow.id, JSON.stringify(ocrBlocks))
        }
        catch (e: unknown) {
          logger.error(e as Error, 'OCR Error:')
          ocrBlocks = []
        }
      }

      if (ocrBlocks && ocrBlocks.length > 0) {
        const { processedBlocks } = await runWorkerTask<{ processedBlocks: unknown[] }>('tokenizeOcrBlocks', { blocks: ocrBlocks, language: bookLang })
        ocrBlocks = processedBlocks
      }

      return {
        bookId,
        pageNum,
        totalPages: book.totalPages,
        type: 'manga',
        imageUrl: `/api/books/${bookId}/page/${pageNum}/image`,
        imageWidth: pageRow.imageWidth,
        imageHeight: pageRow.imageHeight,
        ocrBlocks: ocrBlocks || [],
        content: '',
      }
    }

    const cached = await this.bookRepo.getNlpCache(bookId, pageNum)
    if (cached) {
      try {
        const parsed = JSON.parse(decompressData(cached.data)) as PagePayload
        delete parsed.pageDictionary
        return parsed
      }
      catch { }
    }

    const pageRow = await this.bookRepo.getBookPageContent(bookId, pageNum)
    if (!pageRow)
      throw new AppError(404, 'Страница не найдена')

    const { processedHtml } = await runWorkerTask<{ processedHtml: string }>('tokenizeHtmlPage', { html: pageRow.content, language: bookLang })
    const payload: PagePayload = { bookId, pageNum, totalPages: book.totalPages, content: processedHtml, type: 'epub' }

    await this.bookRepo.upsertNlpCache(bookId, pageNum, JSON.stringify(payload))
    return payload
  }

  async getPageDictionary(bookId: number, pageNum: number, userId: number, targetLang: string) {
    const book = await this.bookRepo.getBookLangAndType(bookId)
    if (!book)
      throw new AppError(404, 'Книга не найдена')
    if (book.userId !== userId && !book.isPublic)
      throw new AppError(403, 'Нет доступа к книге')

    let uniqueWords: string[] = []
    const bookLang = normalizeLanguageCode(book.language)

    if (book.type === 'manga') {
      const pageRow = await this.bookRepo.getMangaPageInfo(bookId, pageNum)
      const ocrBlocks = pageRow?.ocrData ? JSON.parse(pageRow.ocrData) : []
      if (ocrBlocks && ocrBlocks.length > 0) {
        const { uniqueWords: ocrWords } = await runWorkerTask<{ uniqueWords: string[] }>('tokenizeOcrBlocks', { blocks: ocrBlocks, language: bookLang })
        uniqueWords = ocrWords
      }
    }
    else {
      const cached = await this.bookRepo.getNlpCache(bookId, pageNum)
      if (cached) {
        const parsed = JSON.parse(decompressData(cached.data)) as PagePayload
        uniqueWords = extractUniqueWordsFromHtml(parsed.content)
      }
      else {
        const pageRow = await this.bookRepo.getBookPageInfo(bookId, pageNum)
        if (pageRow) {
          const { uniqueWords: epWords } = await runWorkerTask<{ uniqueWords: string[] }>('tokenizeHtmlPage', { html: pageRow.content, language: bookLang })
          uniqueWords = epWords
        }
      }
    }

    return dictionaryService.lookupWords(uniqueWords, bookLang, targetLang, userId)
  }

  async lookupWord(bookId: number, word: string, userId: number, targetLang: string) {
    const book = await this.bookRepo.getBookLanguage(bookId)
    if (!book || (book.userId !== userId && !book.isPublic))
      throw new AppError(403, 'Нет доступа')

    const lang = normalizeLanguageCode(book.language || 'en')
    const entry = await dictionaryService.lookupSingleWord(decodeURIComponent(word), lang, targetLang, userId)
    if (!entry)
      throw new AppError(404, 'Слово не найдено в локальном словаре')
    return entry
  }

  async generateTts(bookId: number, userId: number, text: string, voice: string, forceCacheBypass: boolean, config: LlmConfig) {
    const book = await this.bookRepo.getBookUserIdAndPublic(bookId)
    if (!book || (book.userId !== userId && !book.isPublic))
      throw new AppError(403, 'Нет доступа')

    if (forceCacheBypass) {
      const user = await this.bookRepo.getUserRole(userId)
      if (user?.role !== 'admin')
        throw new AppError(403, 'Только администратор может игнорировать кэш')
    }

    return generateTts(userId, bookId, text, config, voice, forceCacheBypass)
  }

  async standaloneTts(userId: number, text: string, voice: string, forceCacheBypass: boolean, config: LlmConfig) {
    if (forceCacheBypass) {
      const user = await this.bookRepo.getUserRole(userId)
      if (user?.role !== 'admin')
        throw new AppError(403, 'Только администратор может игнорировать кэш')
    }
    return generateTts(userId, null, text, config, voice, forceCacheBypass)
  }
}

export const bookService = new BookService()
