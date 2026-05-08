import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import AdmZip from 'adm-zip'
import sizeOf from 'image-size'
import { BOOKS_PATH, COVERS_PATH } from '../config'
import { sqlite } from '../db'

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

  const insertBook = sqlite.prepare(`
    INSERT INTO books (type, title, author, coverUrl, filePath, language, totalPages, toc)
    VALUES ('manga', ?, null, ?, ?, 'ja', ?, '[]')
  `)
  const result = insertBook.run(title, coverUrl, mangaDir, imageEntries.length)
  const bookId = result.lastInsertRowid as number

  const insertPage = sqlite.prepare(`
    INSERT INTO manga_pages (bookId, pageNum, imageUrl, imageWidth, imageHeight)
    VALUES (?, ?, ?, ?, ?)
  `)

  const insertMany = sqlite.transaction(() => {
    imageEntries.forEach((entry, idx) => {
      const pageNum = idx + 1
      const ext = path.extname(entry.entryName)
      const outPath = path.join(mangaDir, `page_${pageNum}${ext}`)
      const buffer = entry.getData()

      writeFileSync(outPath, buffer)
      const dimensions = sizeOf(buffer)

      insertPage.run(bookId, pageNum, outPath, dimensions.width || 0, dimensions.height || 0)
    })
  })
  insertMany()

  sqlite.prepare(`
    INSERT OR IGNORE INTO reading_progress (bookId, currentPage)
    VALUES (?, 1)
  `).run(bookId)

  return bookId
}
