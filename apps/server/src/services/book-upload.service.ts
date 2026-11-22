import { unlink } from 'node:fs/promises'
import path from 'node:path'
import { normalizeLanguageCode } from '~/utils/helpers'
import { BOOKS_PATH } from '../config'
import { ERROR_CODES } from '../constants/error-codes'
import { bookRepository } from '../repositories/book.repository'
import { AppError } from '../utils/errors'
import { runWorkerTask } from '../workers/worker-client'
import { resolveBookUploadFormat } from './book-upload-format'
import { checkBookLimit } from './limits.service'

export class BookUploadService {
  async uploadBook(userId: number, file: File) {
    await checkBookLimit(userId)

    const MAX_FILE_SIZE = 5000 * 1024 * 1024

    if (file.size > MAX_FILE_SIZE) {
      throw new AppError(
        413,
        ERROR_CODES.BOOK.FILE_TOO_LARGE,
        'File size exceeds 5 GB limit',
        { maxMb: 5000, sizeMb: (file.size / 1024 / 1024).toFixed(2) },
      )
    }

    const format = await resolveBookUploadFormat(file)

    if (!format) {
      throw new AppError(400, ERROR_CODES.BOOK.INVALID_FILE_TYPE, 'Supported formats: .epub, .fb2, .docx, .txt, .md, .srt, .vtt, .ass, .html, .pdf, .mobi, .azw3, .cbz, .cbr, .zip, .rar')
    }

    const { extension, filename, worker } = format
    const filePath = path.join(BOOKS_PATH, `${crypto.randomUUID()}${extension}`)
    let bookId: number

    try {
      await Bun.write(filePath, file)
      bookId = await runWorkerTask(worker, { filePath, filename, userId })
    }
    catch (err) {
      await unlink(filePath).catch(() => {})
      throw err
    }

    const book = await bookRepository.findFirstBook(bookId)

    return { success: true, book }
  }

  async createCustomBook(userId: number, body: { title: string, text: string, targetLang: string, author?: string | null, collection?: string | null, coverBase64?: string, type?: string, language?: string }) {
    await checkBookLimit(userId)

    const safeName = `${Date.now()}_custom_manga`
    const filePath = path.join(BOOKS_PATH, safeName)

    const insertedBook = await bookRepository.createCustomBookWithProgress({
      userId,
      type: body.type,
      title: body.title,
      author: body.author || null,
      filePath,
      language: body.language ? normalizeLanguageCode(body.language) : 'en',
      totalPages: 0,
      toc: '[]',
    }, userId)

    return { success: true, book: insertedBook }
  }

  async appendMangaChapter(
    id: number,
    userId: number,
    chapterTitle: string,
    files: File[],
  ) {
    if (!files.length)
      throw new AppError(400, ERROR_CODES.BOOK.FILE_REQUIRED, 'Files are required')

    const book = await bookRepository.findFirstBook(id)

    if (!book || book.userId !== userId)
      throw new AppError(403, ERROR_CODES.BOOK.ACCESS_DENIED, 'Access denied to book')

    const { appendMangaChapter } = await import('./book-parsers/manga.service')
    await appendMangaChapter(book, chapterTitle, files)

    const updatedBook = await bookRepository.findFirstBook(id)

    return { success: true, book: updatedBook }
  }
}

export const bookUploadService = new BookUploadService()
