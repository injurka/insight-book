import path from 'node:path'
import { normalizeLanguageCode } from '~/utils/helpers'
import { BOOKS_PATH } from '../config'
import { bookRepository } from '../repositories/book.repository'
import { AppError } from '../utils/errors'
import { runWorkerTask } from '../workers/worker-client'
import { checkBookLimit } from './limits.service'

export class BookUploadService {
  async uploadBook(userId: number, file: File) {
    await checkBookLimit(userId)

    const MAX_FILE_SIZE = 5000 * 1024 * 1024
    if (file.size > MAX_FILE_SIZE) {
      throw new AppError(413, `Размер файла превышает лимит в 5 ГБ. Ваш файл: ${(file.size / 1024 / 1024).toFixed(2)} МБ`)
    }

    const filename = file.name.toLowerCase()
    let bookId: number

    if (filename.endsWith('.epub') || filename.endsWith('.fb2') || filename.endsWith('.fb2.zip') || filename.endsWith('.cbz') || filename.endsWith('.zip')) {
      const safeName = `${Date.now()}_${file.name.replace(/[^\w.-]/g, '_')}`
      const filePath = path.join(BOOKS_PATH, safeName)
      await Bun.write(filePath, file)

      if (filename.endsWith('.epub')) {
        bookId = await runWorkerTask('processEpub', { filePath, filename: file.name, userId })
      }
      else if (filename.endsWith('.fb2') || filename.endsWith('.fb2.zip')) {
        bookId = await runWorkerTask('processFb2', { filePath, filename: file.name, userId })
      }
      else if (filename.endsWith('.cbz') || filename.endsWith('.zip')) {
        bookId = await runWorkerTask('processCbz', { filePath, filename: file.name, userId })
      }
      else {
        throw new AppError(400, 'Поддерживаются только .epub, .cbz, .zip и .fb2 файлы')
      }
    }
    else {
      throw new AppError(400, 'Поддерживаются только .epub, .cbz, .zip и .fb2 файлы')
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

  async appendMangaChapter(id: number, userId: number, chapterTitle: string, files: File[]) {
    if (!files.length)
      throw new AppError(400, 'Файлы не переданы')

    const book = await bookRepository.findFirstBook(id)
    if (!book || book.userId !== userId)
      throw new AppError(403, 'Нет доступа к книге')

    const { appendMangaChapter } = await import('../services/manga.service')
    await appendMangaChapter(book, chapterTitle, files)

    const updatedBook = await bookRepository.findFirstBook(id)
    return { success: true, book: updatedBook }
  }
}

export const bookUploadService = new BookUploadService()
