import type { TocItem } from '../../types'
import { unlink } from 'node:fs/promises'
import path from 'node:path'
import AdmZip from 'adm-zip'
import * as cheerio from 'cheerio'
import { eq } from 'drizzle-orm'
import { createExtractorFromData } from 'node-unrar-js'
import { BOOKS_PATH, UPLOADS_PATH } from '../../config'
import { ERROR_CODES } from '../../constants/error-codes'
import { db } from '../../db'
import * as schema from '../../db/schema'
import { AppError } from '../../utils/errors'
import { logger } from '../../utils/logger'
import { storageService } from '../storage.service'

export interface ArchiveEntry {
  name: string
  getData: () => Buffer
}

export async function extractArchiveEntries(filePath: string, filename: string): Promise<ArchiveEntry[]> {
  const bytes = await Bun.file(filePath).bytes()
  const isRarMagic = bytes.length >= 4
    && bytes[0] === 0x52
    && bytes[1] === 0x61
    && bytes[2] === 0x72
    && bytes[3] === 0x21
  const isRarExt = /\.(?:cbr|rar)$/i.test(filename) || /\.(?:cbr|rar)$/i.test(filePath)

  if (isRarMagic || isRarExt) {
    const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
    const extractor = await createExtractorFromData({ data: arrayBuffer })
    const extracted = extractor.extract()
    const entries: ArchiveEntry[] = []

    for (const file of extracted.files) {
      if (!file.fileHeader.flags.directory && file.extraction) {
        const fileData = Buffer.from(file.extraction)
        entries.push({
          name: file.fileHeader.name,
          getData: () => fileData,
        })
      }
    }

    return entries
  }

  const zip = new AdmZip(filePath)

  return zip.getEntries()
    .filter(entry => !entry.isDirectory)
    .map(entry => ({
      name: entry.entryName,
      getData: () => entry.getData(),
    }))
}

export async function processCbz(filePath: string, filename: string, userId: number): Promise<number> {
  try {
    const mangaDir = filePath.replace(/\.(cbz|cbr|zip|rar)$/i, '')

    const archiveEntries = await extractArchiveEntries(filePath, filename)

    const imageEntries = archiveEntries
    // eslint-disable-next-line regexp/no-unused-capturing-group
      .filter(entry => /\.(jpg|jpeg|png|webp|avif)$/i.test(entry.name))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))

    if (imageEntries.length === 0) {
      throw new AppError(400, ERROR_CODES.BOOK.MANGA_NO_IMAGES, 'Archive contains no images')
    }

    let tocJson = '[]'
    let xmlTitle = ''
    const xmlEntry = archiveEntries.find(e => e.name.toLowerCase().endsWith('comicinfo.xml'))

    if (xmlEntry) {
      try {
        const xmlString = xmlEntry.getData().toString('utf-8')
        const $ = cheerio.load(xmlString, { xmlMode: true })
        const tocList: TocItem[] = []

        xmlTitle = $('Title').first().text().trim()

        $('Page').each((_, el) => {
          const bookmark = $(el).attr('Bookmark')
          const imageIdx = Number.parseInt($(el).attr('Image') || '0', 10)

          if (bookmark) {
            tocList.push({
              id: `chap-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
              href: '',
              title: bookmark,
              order: tocList.length,
              level: 1,
              pageNum: imageIdx + 1,
            })
          }
        })

        if (tocList.length > 0) {
          tocJson = JSON.stringify(tocList)
        }
      }
      catch (e) {
        logger.warn(e, '[Manga Service] Failed to parse ComicInfo.xml:')
      }
    }

    const coverEntry = imageEntries[0]
    const coverBuffer = coverEntry.getData()
    const coverExt = path.extname(coverEntry.name).toLowerCase() || '.jpg'
    const coverFilename = `${Date.now()}_cover${coverExt}`
    await storageService.uploadFile(`covers/${coverFilename}`, coverBuffer, `image/${coverExt.slice(1)}`)
    const coverUrl = `/api/uploads/covers/${coverFilename}`

    const title = xmlTitle || filename.replace(/\.(cbz|cbr|zip|rar)$/i, '')

    const bookId = await db.transaction(async (tx) => {
      const [insertedBook] = await tx.insert(schema.books).values({
        userId,
        type: 'manga',
        title,
        author: null,
        coverUrl,
        filePath: mangaDir,
        language: 'ja',
        totalPages: imageEntries.length,
        toc: tocJson,
      }).returning({ id: schema.books.id })

      const bId = insertedBook.id

      const pagesToInsert: { bookId: number, pageNum: number, imageUrl: string, imageWidth: number, imageHeight: number }[] = []

      for (let idx = 0; idx < imageEntries.length; idx++) {
        const entry = imageEntries[idx]
        const pageNum = idx + 1
        const ext = path.extname(entry.name).toLowerCase()
        const buffer = entry.getData()
        const dimensions = await new Bun.Image(buffer).metadata()

        const folderName = path.basename(filePath).replace(/\.(cbz|cbr|zip|rar)$/i, '')
        const key = `books/${folderName}/page_${pageNum}${ext}`
        const imageUrl = await storageService.uploadFile(key, buffer, `image/${ext.slice(1)}`)

        pagesToInsert.push({
          bookId: bId,
          pageNum,
          imageUrl,
          imageWidth: dimensions.width || 0,
          imageHeight: dimensions.height || 0,
        })
      }

      const chunkSize = 1000

      for (let i = 0; i < pagesToInsert.length; i += chunkSize) {
        const chunk = pagesToInsert.slice(i, i + chunkSize)
        await tx.insert(schema.mangaPages).values(chunk).onConflictDoNothing()
      }

      await tx.insert(schema.readingProgress).values({
        bookId: bId,
        userId,
        currentPage: 1,
      }).onConflictDoNothing()

      return bId
    })

    return bookId
  }
  finally {
    await unlink(filePath).catch(() => {})
  }
}

export async function appendMangaChapter(book: { id: number, totalPages: number, coverUrl: string | null, filePath: string, toc?: string | null | TocItem[] }, chapterTitle: string, files: File[]) {
  const startPageNum = book.totalPages + 1
  let currentPageNum = startPageNum

  const pagesToInsert: { bookId: number, pageNum: number, imageUrl: string, imageWidth: number, imageHeight: number }[] = []

  files.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))

  let coverUrl = book.coverUrl

  for (const file of files) {
    const ext = path.extname(file.name).toLowerCase() || '.jpg'
    const filename = `page_${currentPageNum}${ext}`
    const folderName = path.basename(book.filePath)

    // Пишем временно на диск в папку книги напрямую
    const fullPath = path.join(BOOKS_PATH, folderName, filename)
    await Bun.write(fullPath, file)

    const dimensions = await Bun.file(fullPath).image().metadata()

    // Если нужно, заливаем в S3 через storageService
    // Но так как mangaFiles обычно живут в BOOKS_PATH локально (либо монтируются),
    // мы можем прочитать файл и отправить, либо, если local, просто оставить.
    // Оставим логику storageService как было, но передадим путь/файл.
    // Чтобы не дублировать, передадим buffer из локального файла, если это S3,
    // либо можно сразу заюзать file в storageService.
    const key = `books/${folderName}/${filename}`
    let imageUrl = key

    // Если используется S3, зальем напрямую из файла
    if (storageService.constructor.name !== 'LocalStorageService') {
      const buffer = await Bun.file(fullPath).arrayBuffer()
      imageUrl = await storageService.uploadFile(key, buffer, `image/${ext.slice(1)}`)
    }

    pagesToInsert.push({
      bookId: book.id,
      pageNum: currentPageNum,
      imageUrl,
      imageWidth: dimensions.width || 0,
      imageHeight: dimensions.height || 0,
    })

    if (currentPageNum === 1 && !coverUrl) {
      const coverFilename = `${Date.now()}_cover${ext}`

      if (storageService.constructor.name === 'LocalStorageService') {
        const coverPath = path.join(UPLOADS_PATH, `covers/${coverFilename}`)
        await Bun.write(coverPath, file)
      }
      else {
        const coverBuffer = await Bun.file(fullPath).arrayBuffer()
        await storageService.uploadFile(`covers/${coverFilename}`, coverBuffer, `image/${ext.slice(1)}`)
      }

      coverUrl = `/api/uploads/covers/${coverFilename}`
    }

    currentPageNum++
  }

  await db.transaction(async (tx) => {
    const chunkSize = 1000

    for (let i = 0; i < pagesToInsert.length; i += chunkSize) {
      const chunk = pagesToInsert.slice(i, i + chunkSize)
      await tx.insert(schema.mangaPages).values(chunk).onConflictDoNothing()
    }

    let toc: TocItem[] = []

    if (typeof book.toc === 'string') {
      toc = JSON.parse(book.toc || '[]')
    }
    else if (Array.isArray(book.toc)) {
      toc = [...book.toc]
    }

    if (chapterTitle) {
      toc.push({
        id: `chap-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        href: '',
        title: chapterTitle,
        order: toc.length,
        level: 1,
        pageNum: startPageNum,
      })
    }

    await tx.update(schema.books).set({
      totalPages: book.totalPages + files.length,
      toc: JSON.stringify(toc),
      coverUrl,
      updatedAt: new Date().toISOString(),
    }).where(eq(schema.books.id, book.id))
  })
}
