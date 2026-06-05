import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import AdmZip from 'adm-zip'
import * as cheerio from 'cheerio'
import { eq } from 'drizzle-orm'
import sizeOf from 'image-size'
import { BOOKS_PATH, COVERS_PATH } from '../config'
import { db } from '../db'
import * as schema from '../db/schema'

export async function processCbz(fileBuffer: ArrayBuffer, filename: string, userId: number): Promise<number> {
  const safeName = `${Date.now()}_${filename.replace(/[^\w.-]/g, '_')}`
  const mangaDir = path.join(BOOKS_PATH, safeName.replace(/\.(cbz|zip)$/i, ''))

  mkdirSync(mangaDir, { recursive: true })

  const zip = new AdmZip(Buffer.from(fileBuffer))
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
      const tocList: any[] = []

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
      console.warn('[Manga Service] Failed to parse ComicInfo.xml:', e)
    }
  }

  const coverEntry = imageEntries[0]
  const coverBuffer = coverEntry.getData()
  const coverExt = path.extname(coverEntry.entryName).toLowerCase() || '.jpg'
  const coverFilename = `${Date.now()}_cover${coverExt}`
  const coverPath = path.join(COVERS_PATH, coverFilename)
  writeFileSync(coverPath, coverBuffer)
  const coverUrl = `/api/uploads/covers/${coverFilename}`

  const title = xmlTitle || filename.replace(/\.(cbz|zip)$/i, '')

  const [insertedBook] = await db.insert(schema.books).values({
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

  const bookId = insertedBook.id

  const pagesToInsert: { bookId: number, pageNum: number, imageUrl: string, imageWidth: number, imageHeight: number }[] = []

  imageEntries.forEach((entry, idx) => {
    const pageNum = idx + 1
    const ext = path.extname(entry.entryName)
    const outPath = path.join(mangaDir, `page_${pageNum}${ext}`)
    const buffer = entry.getData()

    writeFileSync(outPath, buffer)
    const dimensions = sizeOf(buffer)

    pagesToInsert.push({
      bookId,
      pageNum,
      imageUrl: outPath,
      imageWidth: dimensions.width || 0,
      imageHeight: dimensions.height || 0,
    })
  })

  const chunkSize = 1000
  for (let i = 0; i < pagesToInsert.length; i += chunkSize) {
    const chunk = pagesToInsert.slice(i, i + chunkSize)
    await db.insert(schema.mangaPages).values(chunk).onConflictDoNothing()
  }

  await db.insert(schema.readingProgress).values({
    bookId,
    userId,
    currentPage: 1,
  }).onConflictDoNothing()

  return bookId
}

export async function appendMangaChapter(book: any, chapterTitle: string, files: File[]) {
  const startPageNum = book.totalPages + 1
  let currentPageNum = startPageNum

  const pagesToInsert: { bookId: number, pageNum: number, imageUrl: string, imageWidth: number, imageHeight: number }[] = []

  files.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))

  let coverUrl = book.coverUrl

  for (const file of files) {
    const buffer = await file.arrayBuffer()
    const ext = path.extname(file.name).toLowerCase() || '.jpg'
    const filename = `page_${currentPageNum}${ext}`
    const outPath = path.join(book.filePath, filename)

    writeFileSync(outPath, Buffer.from(buffer))
    const dimensions = sizeOf(Buffer.from(buffer))

    pagesToInsert.push({
      bookId: book.id,
      pageNum: currentPageNum,
      imageUrl: outPath,
      imageWidth: dimensions.width || 0,
      imageHeight: dimensions.height || 0,
    })

    if (currentPageNum === 1 && !coverUrl) {
      const coverFilename = `${Date.now()}_cover${ext}`
      const coverPath = path.join(COVERS_PATH, coverFilename)
      writeFileSync(coverPath, Buffer.from(buffer))
      coverUrl = `/api/uploads/covers/${coverFilename}`
    }

    currentPageNum++
  }

  const chunkSize = 1000
  for (let i = 0; i < pagesToInsert.length; i += chunkSize) {
    const chunk = pagesToInsert.slice(i, i + chunkSize)
    await db.insert(schema.mangaPages).values(chunk).onConflictDoNothing()
  }

  const toc = JSON.parse(book.toc || '[]')
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

  await db.update(schema.books).set({
    totalPages: book.totalPages + files.length,
    toc: JSON.stringify(toc),
    coverUrl,
    updatedAt: new Date().toISOString(),
  }).where(eq(schema.books.id, book.id))
}
