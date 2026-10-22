import { unlink } from 'node:fs/promises'
import path from 'node:path'
import { normalizeLanguageCode } from '~/utils/helpers'
import { BOOKS_PATH } from '../config'
import { ERROR_CODES } from '../constants/error-codes'
import { bookRepository } from '../repositories/book.repository'
import { AppError } from '../utils/errors'
import { runWorkerTask } from '../workers/worker-client'
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

    const filename = file.name.toLowerCase()
    let bookId: number

    const SUPPORTED_EXTENSIONS = [
      '.epub',
      '.fb2',
      '.fb2.zip',
      '.docx',
      '.txt',
      '.md',
      '.markdown',
      '.srt',
      '.vtt',
      '.ass',
      '.ssa',
      '.html',
      '.htm',
      '.pdf',
      '.mobi',
      '.azw',
      '.azw3',
      '.prc',
      '.cbz',
      '.cbr',
      '.zip',
      '.rar',
    ]
    const SUPPORTED_ERROR_MSG = 'Supported formats: .epub, .fb2, .docx, .txt, .md, .srt, .vtt, .ass, .html, .pdf, .mobi, .azw3, .cbz, .cbr, .zip, .rar'

    if (SUPPORTED_EXTENSIONS.some(ext => filename.endsWith(ext))) {
      const safeName = `${Date.now()}_${file.name.replace(/[^\w.-]/g, '_')}`
      const filePath = path.join(BOOKS_PATH, safeName)
      await Bun.write(filePath, file)

      try {
        if (filename.endsWith('.epub')) {
          bookId = await runWorkerTask('processEpub', { filePath, filename: file.name, userId })
        }
        else if (filename.endsWith('.fb2') || filename.endsWith('.fb2.zip')) {
          bookId = await runWorkerTask('processFb2', { filePath, filename: file.name, userId })
        }
        else if (filename.endsWith('.docx')) {
          bookId = await runWorkerTask('processDocx', { filePath, filename: file.name, userId })
        }
        else if (filename.endsWith('.txt')) {
          bookId = await runWorkerTask('processTxt', { filePath, filename: file.name, userId })
        }
        else if (filename.endsWith('.md') || filename.endsWith('.markdown')) {
          bookId = await runWorkerTask('processMarkdown', { filePath, filename: file.name, userId })
        }
        else if (filename.endsWith('.srt') || filename.endsWith('.vtt') || filename.endsWith('.ass') || filename.endsWith('.ssa')) {
          bookId = await runWorkerTask('processSubtitle', { filePath, filename: file.name, userId })
        }
        else if (filename.endsWith('.html') || filename.endsWith('.htm')) {
          bookId = await runWorkerTask('processHtml', { filePath, filename: file.name, userId })
        }
        else if (filename.endsWith('.pdf')) {
          bookId = await runWorkerTask('processPdf', { filePath, filename: file.name, userId })
        }
        else if (filename.endsWith('.mobi') || filename.endsWith('.azw') || filename.endsWith('.azw3') || filename.endsWith('.prc')) {
          bookId = await runWorkerTask('processMobi', { filePath, filename: file.name, userId })
        }
        else if (filename.endsWith('.cbz') || filename.endsWith('.cbr') || filename.endsWith('.zip') || filename.endsWith('.rar')) {
          bookId = await runWorkerTask('processCbz', { filePath, filename: file.name, userId })
        }
        else {
          throw new AppError(400, ERROR_CODES.BOOK.INVALID_FILE_TYPE, SUPPORTED_ERROR_MSG)
        }
      }
      catch (err) {
        await unlink(filePath).catch(() => {})
        throw err
      }
    }
    else {
      throw new AppError(400, ERROR_CODES.BOOK.INVALID_FILE_TYPE, SUPPORTED_ERROR_MSG)
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
