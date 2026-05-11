import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import AdmZip from 'adm-zip'
import sizeOf from 'image-size'
import { BOOKS_PATH, COVERS_PATH } from '../config'
import { db } from '../db'
import * as schema from '../db/schema'

export async function processCbz(fileBuffer: ArrayBuffer, filename: string): Promise<number> {
  const safeName = `${Date.now()}_${filename.replace(/[^\w.-]/g, '_')}`
  const mangaDir = path.join(BOOKS_PATH, safeName.replace(/\.(cbz|zip)$/i, ''))

  mkdirSync(mangaDir, { recursive: true })

  const zip = new AdmZip(Buffer.from(fileBuffer))
  const zipEntries = zip.getEntries()

  const imageEntries = zipEntries
    .filter(entry => !entry.isDirectory && /\.(jpg|jpeg|png|webp|avif)$/i.test(entry.entryName))
    .sort((a, b) => a.entryName.localeCompare(b.entryName, undefined, { numeric: true }))

  if (imageEntries.length === 0) {
    throw new Error('Архив не содержит изображений')
  }

  const coverEntry = imageEntries[0]
  const coverBuffer = coverEntry.getData()
  const coverExt = path.extname(coverEntry.entryName).toLowerCase() || '.jpg'
  const coverFilename = `${Date.now()}_cover${coverExt}`
  const coverPath = path.join(COVERS_PATH, coverFilename)
  writeFileSync(coverPath, coverBuffer)
  const coverUrl = `/api/uploads/covers/${coverFilename}`

  const title = filename.replace(/\.(cbz|zip)$/i, '')

  // Drizzle ORM Вставки
  const [insertedBook] = await db.insert(schema.books).values({
    type: 'manga',
    title,
    author: null,
    coverUrl,
    filePath: mangaDir,
    language: 'ja',
    totalPages: imageEntries.length,
    toc: '[]',
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

  // Вставка страниц порциями по 50
  const chunkSize = 50
  for (let i = 0; i < pagesToInsert.length; i += chunkSize) {
    const chunk = pagesToInsert.slice(i, i + chunkSize)
    await db.insert(schema.mangaPages).values(chunk).onConflictDoNothing()
  }

  await db.insert(schema.readingProgress).values({
    bookId,
    currentPage: 1,
  }).onConflictDoNothing()

  return bookId
}
