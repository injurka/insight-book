import type { TocItem } from '../../types'
import { unlink } from 'node:fs/promises'
import path from 'node:path'
import AdmZip from 'adm-zip'
import * as cheerio from 'cheerio'
import { eq } from 'drizzle-orm'
import { createExtractorFromData } from 'node-unrar-js'
import { normalizeLanguageCode } from '~/utils/helpers'
import { ERROR_CODES } from '../../constants/error-codes'
import { db } from '../../db'
import * as schema from '../../db/schema'
import { AppError } from '../../utils/errors'
import { logger } from '../../utils/logger'
import { storageService } from '../storage.service'
import { parseBookContent, unreadableBook } from './book-parser.utils'

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
  const mangaDir = filePath.replace(/\.(cbz|cbr|zip|rar)$/i, '')
  const storageFolder = `books/${path.basename(mangaDir)}`
  let coverKey: string | undefined

  try {
    const archiveEntries = await parseBookContent(() => extractArchiveEntries(filePath, filename))

    const imageEntries = archiveEntries
    // eslint-disable-next-line regexp/no-unused-capturing-group
      .filter(entry => /\.(jpg|jpeg|png|webp|avif)$/i.test(entry.name))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))

    if (imageEntries.length === 0) {
      throw new AppError(400, ERROR_CODES.BOOK.MANGA_NO_IMAGES, 'Archive contains no images')
    }

    let tocJson = '[]'
    let xmlTitle = ''
    let author: string | null = null
    let language = 'ja'
    const xmlEntry = archiveEntries.find(e => e.name.toLowerCase().endsWith('comicinfo.xml'))

    if (xmlEntry) {
      try {
        const xmlString = xmlEntry.getData().toString('utf-8')
        const $ = cheerio.load(xmlString, { xmlMode: true })
        const tocList: TocItem[] = []

        xmlTitle = $('Title').first().text().trim()
        author = $('Writer').first().text().trim() || null
        language = normalizeLanguageCode($('LanguageISO').first().text().trim()) || 'ja'

        $('Page').each((_, el) => {
          const bookmark = $(el).attr('Bookmark')
          const image = $(el).attr('Image')
          const imageIdx = image?.trim() ? Number(image) : -1

          if (bookmark && Number.isInteger(imageIdx) && imageIdx >= 0 && imageIdx < imageEntries.length) {
            tocList.push({
              id: `chap-${tocList.length}`,
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
    coverKey = `covers/${crypto.randomUUID()}${coverExt}`
    await storageService.uploadFile(coverKey, coverBuffer, imageMime(coverExt))
    const coverUrl = `/api/uploads/${coverKey}`

    const title = xmlTitle || filename.replace(/\.(cbz|cbr|zip|rar)$/i, '')

    const bookId = await db.transaction(async (tx) => {
      const [insertedBook] = await tx.insert(schema.books).values({
        userId,
        type: 'manga',
        title,
        author,
        coverUrl,
        filePath: mangaDir,
        language,
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
        const dimensions = await readImageMetadata(buffer)
        const key = `${storageFolder}/page_${pageNum}${ext}`
        const imageUrl = await storageService.uploadFile(key, buffer, imageMime(ext))

        pagesToInsert.push({
          bookId: bId,
          pageNum,
          imageUrl,
          imageWidth: dimensions.width,
          imageHeight: dimensions.height,
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
  catch (error) {
    await cleanupMangaAssets(storageFolder, coverKey)
    throw error
  }
  finally {
    await unlink(filePath).catch(() => {})
  }
}

function imageMime(extension: string): string {
  return extension === '.jpg' ? 'image/jpeg' : `image/${extension.slice(1)}`
}

async function readImageMetadata(bytes: Uint8Array) {
  const { width, height, format } = await parseBookContent(() => new Bun.Image(bytes).metadata())

  if (!width || !height)
    throw unreadableBook('The archive contains an unreadable image')

  return { width, height, format }
}

async function cleanupMangaAssets(folder: string, coverKey?: string) {
  await storageService.deleteFolder(`${folder}/`).catch(() => {})

  if (coverKey)
    await storageService.deleteFile(coverKey).catch(() => {})
}

export async function appendMangaChapter(book: { id: number, filePath: string }, chapterTitle: string, files: File[]) {
  const folder = `books/${path.basename(book.filePath)}/${crypto.randomUUID()}`
  let coverKey: string | undefined

  try {
    const pages: { imageUrl: string, imageWidth: number, imageHeight: number }[] = []
    const sortedFiles = [...files].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))

    for (const [index, file] of sortedFiles.entries()) {
      const bytes = await file.bytes()
      const { width, height, format } = await readImageMetadata(bytes)
      const ext = `.${format}`
      const imageUrl = await storageService.uploadFile(`${folder}/page_${index + 1}${ext}`, bytes, imageMime(ext))

      pages.push({ imageUrl, imageWidth: width, imageHeight: height })
    }

    await db.transaction(async (tx) => {
      const currentBook = await tx.query.books.findFirst({ where: eq(schema.books.id, book.id) })

      if (!currentBook)
        throw new AppError(404, ERROR_CODES.BOOK.NOT_FOUND, 'Book not found')

      const startPageNum = currentBook.totalPages + 1
      let coverUrl = currentBook.coverUrl

      if (startPageNum === 1 && !coverUrl) {
        const firstFile = sortedFiles[0]
        const ext = path.extname(pages[0].imageUrl)
        coverKey = `covers/${crypto.randomUUID()}${ext}`
        await storageService.uploadFile(coverKey, await firstFile.bytes(), imageMime(ext))
        coverUrl = `/api/uploads/${coverKey}`
      }

      const pagesToInsert = pages.map((page, index) => ({
        ...page,
        bookId: book.id,
        pageNum: startPageNum + index,
      }))
      const chunkSize = 1000

      for (let i = 0; i < pagesToInsert.length; i += chunkSize) {
        await tx.insert(schema.mangaPages).values(pagesToInsert.slice(i, i + chunkSize))
      }

      const toc: TocItem[] = JSON.parse(currentBook.toc || '[]')

      if (chapterTitle) {
        const order = toc.length
        toc.push({
          id: `chap-${order}`,
          href: '',
          title: chapterTitle,
          order,
          level: 1,
          pageNum: startPageNum,
        })
      }

      await tx.update(schema.books).set({
        totalPages: currentBook.totalPages + pages.length,
        toc: JSON.stringify(toc),
        coverUrl,
        updatedAt: new Date().toISOString(),
      }).where(eq(schema.books.id, book.id))
    })
  }
  catch (error) {
    await cleanupMangaAssets(folder, coverKey)
    throw error
  }
}
