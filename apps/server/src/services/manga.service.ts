import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import AdmZip from 'adm-zip'
import sizeOf from 'image-size'
import { UPLOADS_PATH } from '../config'
import { sqlite } from '../db'

export async function processCbz(fileBuffer: ArrayBuffer, filename: string): Promise<number> {
  const safeName = `${Date.now()}_${filename.replace(/[^\w.-]/g, '_')}`
  const mangaDir = path.join(UPLOADS_PATH, safeName.replace(/\.(cbz|zip)$/i, ''))

  mkdirSync(mangaDir, { recursive: true })

  const zip = new AdmZip(Buffer.from(fileBuffer))
  const zipEntries = zip.getEntries()

  // Фильтруем только картинки и сортируем их по имени
  const imageEntries = zipEntries
    .filter(entry => !entry.isDirectory && /\.(jpg|jpeg|png|webp|avif)$/i.test(entry.entryName))
    .sort((a, b) => a.entryName.localeCompare(b.entryName, undefined, { numeric: true }))

  if (imageEntries.length === 0) {
    throw new Error('Архив не содержит изображений')
  }

  // Обложка — первая картинка
  const coverEntry = imageEntries[0]
  const coverBuffer = coverEntry.getData()
  const coverMime = `image/${path.extname(coverEntry.entryName).slice(1).toLowerCase()}`
  const coverBase64 = `data:${coverMime};base64,${coverBuffer.toString('base64')}`

  const title = filename.replace(/\.(cbz|zip)$/i, '')

  // Вставляем книгу (type: manga, язык по умолчанию для манги ставим 'ja')
  const insertBook = sqlite.prepare(`
    INSERT INTO books (type, title, author, coverBase64, filePath, language, totalPages, toc)
    VALUES ('manga', ?, null, ?, ?, 'ja', ?, '[]')
  `)
  const result = insertBook.run(title, coverBase64, mangaDir, imageEntries.length)
  const bookId = result.lastInsertRowid as number

  // Вставляем страницы в новую таблицу manga_pages
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
      const dimensions = sizeOf(buffer) // Получаем размеры картинки

      insertPage.run(bookId, pageNum, outPath, dimensions.width || 0, dimensions.height || 0)
    })
  })
  insertMany()

  // Инициализируем прогресс чтения
  sqlite.prepare(`
    INSERT OR IGNORE INTO reading_progress (bookId, currentPage)
    VALUES (?, 1)
  `).run(bookId)

  return bookId
}
