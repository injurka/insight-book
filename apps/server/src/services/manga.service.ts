import type { TocItem } from '../types'
import path from 'node:path'
import AdmZip from 'adm-zip'
import * as cheerio from 'cheerio'
import { eq } from 'drizzle-orm'
import sizeOf from 'image-size'
import { BOOKS_PATH, UPLOADS_PATH } from '../config'
import { db } from '../db'
import * as schema from '../db/schema'
import { logger } from '../utils/logger'
import { storageService } from './storage.service'

export async function processCbz(filePath: string, filename: string, userId: number): Promise<number> {
  const mangaDir = filePath.replace(/\.(cbz|zip)$/i, '')

  const zip = new AdmZip(filePath)
  const zipEntries = zip.getEntries()

  const imageEntries = zipEntries
    // eslint-disable-next-line regexp/no-unused-capturing-group
    .filter(entry => !entry.isDirectory && /\.(jpg|jpeg|png|webp|avif)$/i.test(entry.entryName))
    .sort((a, b) => a.entryName.localeCompare(b.entryName, undefined, { numeric: true }))

  if (imageEntries.length === 0) {
    throw new Error('Архив не содержит изображений')
  }

  let tocJson = '[]'
  let xmlTitle = ''
  const xmlEntry = zipEntries.find(e => e.entryName.toLowerCase().endsWith('comicinfo.xml'))

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
  const coverExt = path.extname(coverEntry.entryName).toLowerCase() || '.jpg'
  const coverFilename = `${Date.now()}_cover${coverExt}`
  await storageService.uploadFile(`covers/${coverFilename}`, coverBuffer, `image/${coverExt.slice(1)}`)
  const coverUrl = `/api/uploads/covers/${coverFilename}`

  const title = xmlTitle || filename.replace(/\.(cbz|zip)$/i, '')

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
      const ext = path.extname(entry.entryName).toLowerCase()
      const buffer = entry.getData()
      const dimensions = sizeOf(buffer)

      const folderName = path.basename(filePath).replace(/\.(cbz|zip)$/i, '')
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

    const dimensions = sizeOf(Buffer.from(await Bun.file(fullPath).arrayBuffer()))

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
