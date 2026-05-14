import { writeFileSync } from 'node:fs'
import path from 'node:path'
import * as cheerio from 'cheerio'
import { BOOKS_PATH, COVERS_PATH, PAGE_SIZE_CHARS } from '../config'
import { db } from '../db'
import * as schema from '../db/schema'

export async function processFb2(fileBuffer: ArrayBuffer, filename: string, userId: number): Promise<number> {
  const safeName = `${Date.now()}_${filename.replace(/[^\w.-]/g, '_')}`
  const filePath = path.join(BOOKS_PATH, safeName)
  await Bun.write(filePath, fileBuffer)

  // Читаем как текст
  const fileContent = await Bun.file(filePath).text()

  // Парсим XML
  const $ = cheerio.load(fileContent, { xmlMode: true })

  // 1. Метаданные
  const titleInfo = $('description title-info')
  const title = titleInfo.find('book-title').text() || filename.replace('.fb2', '')
  const authorFirst = titleInfo.find('author first-name').text()
  const authorLast = titleInfo.find('author last-name').text()
  const author = `${authorFirst} ${authorLast}`.trim() || null
  const language = titleInfo.find('lang').text().substring(0, 2).toLowerCase() || 'ru'

  // 2. Обложка
  let coverUrl = null
  const coverImageHref = titleInfo.find('coverpage image').attr('l:href')
  if (coverImageHref) {
    const imageId = coverImageHref.replace('#', '')
    const binaryNode = $(`binary[id="${imageId}"]`)
    if (binaryNode.length) {
      const base64Data = binaryNode.text().trim()
      const contentType = binaryNode.attr('content-type') || 'image/jpeg'
      const ext = contentType.includes('png') ? '.png' : '.jpg'
      const coverFilename = `${Date.now()}_cover${ext}`
      const coverBuffer = Buffer.from(base64Data, 'base64')
      writeFileSync(path.join(COVERS_PATH, coverFilename), coverBuffer)
      coverUrl = `/api/uploads/covers/${coverFilename}`
    }
  }

  // 3. Обработка текста (разбивка на страницы по размеру)
  const pages: string[] = []
  let currentPageHtml = ''
  let currentLen = 0
  const toc: any[] = []

  const body = $('body').first() // Берем основное тело книги

  body.find('section').each((sectionIndex, sectionEl) => {
    // Оглавление
    const sectionTitle = $(sectionEl).find('> title').text().trim()
    if (sectionTitle) {
      toc.push({
        id: `sec-${sectionIndex}`,
        href: '',
        title: sectionTitle,
        order: sectionIndex,
        level: 1,
        pageNum: pages.length + 1,
      })
      currentPageHtml += `<h2>${sectionTitle}</h2>\n`
      currentLen += sectionTitle.length
    }

    // Содержимое секции
    $(sectionEl).find('> p, > empty-line, > image').each((_, child) => {
      const tagName = child.tagName.toLowerCase()

      if (tagName === 'empty-line') {
        currentPageHtml += '<br/>\n'
      }
      else if (tagName === 'p') {
        const html = $(child).html() || ''
        const textLen = $(child).text().length
        if (textLen > 0) {
          currentPageHtml += `<p>${html}</p>\n`
          currentLen += textLen
        }
      }
      else if (tagName === 'image') {
        // Конвертация встраиваемых картинок прямо в base64 HTML тег
        const href = $(child).attr('l:href')?.replace('#', '')
        if (href) {
          const bin = $(`binary[id="${href}"]`)
          if (bin.length) {
            const b64 = bin.text().trim()
            const type = bin.attr('content-type') || 'image/jpeg'
            currentPageHtml += `<img src="data:${type};base64,${b64}" />\n`
          }
        }
      }

      // Пагинация
      if (currentLen >= PAGE_SIZE_CHARS) {
        pages.push(currentPageHtml)
        currentPageHtml = ''
        currentLen = 0
      }
    })
  })

  // Остаток текста
  if (currentPageHtml.trim()) {
    pages.push(currentPageHtml)
  }

  // Если вдруг книга пустая, создаем 1 страницу-заглушку
  if (pages.length === 0) {
    pages.push('<p>Текст книги не найден или формат не поддерживается.</p>')
  }

  // 4. Сохранение в БД
  const [insertedBook] = await db.insert(schema.books).values({
    userId,
    type: 'fb2',
    title,
    author,
    coverUrl,
    filePath,
    language,
    totalPages: pages.length,
    toc: JSON.stringify(toc),
  }).returning({ id: schema.books.id })

  const bookId = insertedBook.id

  const pagesToInsert = pages.map((content, idx) => ({
    bookId,
    pageNum: idx + 1,
    content,
  }))

  const chunkSize = 50
  for (let i = 0; i < pagesToInsert.length; i += chunkSize) {
    await db.insert(schema.bookPages).values(pagesToInsert.slice(i, i + chunkSize)).onConflictDoNothing()
  }

  await db.insert(schema.readingProgress).values({
    bookId,
    currentPage: 1,
  }).onConflictDoNothing()

  return bookId
}
