import { writeFileSync } from 'node:fs'
import { unlink } from 'node:fs/promises'
import path from 'node:path'
import AdmZip from 'adm-zip'
import * as cheerio from 'cheerio'
import { BOOKS_PATH, COVERS_PATH, PAGE_SIZE_CHARS, UPLOAD_STORAGE } from '../config'
import { db } from '../db'
import * as schema from '../db/schema'
import { s3Service } from './s3.service'

export async function processFb2(fileBuffer: ArrayBuffer, filename: string, userId: number): Promise<number> {
  const safeName = `${Date.now()}_${filename.replace(/[^\w.-]/g, '_')}`
  const filePath = path.join(BOOKS_PATH, safeName)

  if (UPLOAD_STORAGE !== 's3') {
    await Bun.write(filePath, fileBuffer)
  }

  try {
    let fileContent = ''

    try {
      const zip = new AdmZip(Buffer.from(fileBuffer))
      const entries = zip.getEntries()
      const fb2Entry = entries.find(e => e.entryName.toLowerCase().endsWith('.fb2') || e.entryName.toLowerCase().endsWith('.xml'))
      if (fb2Entry) {
        fileContent = fb2Entry.getData().toString('utf-8')
      }
    }
    catch {
    // Ignore ZIP parsing error, proceed as plain text
    }

    if (!fileContent) {
      if (UPLOAD_STORAGE === 's3') {
        fileContent = Buffer.from(fileBuffer).toString('utf-8')
      }
      else {
        fileContent = await Bun.file(filePath).text()
      }
    }

    const $ = cheerio.load(fileContent, { xmlMode: true })

    const titleInfo = $('description title-info')
    const title = titleInfo.find('book-title').text() || filename.replace('.fb2', '')
    const authorFirst = titleInfo.find('author first-name').text()
    const authorLast = titleInfo.find('author last-name').text()
    const author = `${authorFirst} ${authorLast}`.trim() || null
    const language = titleInfo.find('lang').text().substring(0, 2).toLowerCase() || 'ru'

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
        if (UPLOAD_STORAGE === 's3') {
          await s3Service.uploadFile(`covers/${coverFilename}`, coverBuffer, contentType)
        }
        else {
          writeFileSync(path.join(COVERS_PATH, coverFilename), coverBuffer)
        }
        coverUrl = `/api/uploads/covers/${coverFilename}`
      }
    }

    const pages: string[] = []
    let currentPageHtml = ''
    let currentLen = 0
    const toc: any[] = []

    const body = $('body').first()

    body.find('section').each((sectionIndex, sectionEl) => {
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

      // Расширенный селектор для FB2: стихи, цитаты, аннотации и т.д.
      $(sectionEl).find('> p, > empty-line, > image, > v, > subtitle, > cite, > poem, > epigraph, > annotation').each((_, child) => {
        const tagName = child.tagName.toLowerCase()
        let childHtml = ''
        let textLen = 0

        if (tagName === 'empty-line') {
          childHtml = '<br/>\n'
        }
        else if (tagName === 'p' || tagName === 'v') { // <v> часто используется в fb2 для стихов
          const html = $(child).html() || ''
          textLen = $(child).text().length
          if (textLen > 0) {
            childHtml = `<p>${html}</p>\n`
          }
        }
        else if (tagName === 'image') {
          const href = $(child).attr('l:href')?.replace('#', '')
          if (href) {
            const bin = $(`binary[id="${href}"]`)
            if (bin.length) {
              const b64 = bin.text().trim()
              const type = bin.attr('content-type') || 'image/jpeg'
              childHtml = `<img src="data:${type};base64,${b64}" />\n`
            }
          }
        }
        else {
        // Остальные теги (эпиграфы, цитаты) просто оборачиваем в DIV, сохраняя форматирование
          const html = $(child).html() || ''
          textLen = $(child).text().length
          if (textLen > 0) {
            childHtml = `<div class="fb2-${tagName}">${html}</div>\n`
          }
        }

        if (!childHtml)
          return

        // Проверяем лимит ДО добавления блока
        if (currentLen > 0 && currentLen + textLen >= PAGE_SIZE_CHARS) {
          pages.push(currentPageHtml)
          currentPageHtml = ''
          currentLen = 0
        }

        currentPageHtml += childHtml
        currentLen += textLen
      })
    })

    if (currentPageHtml.trim()) {
      pages.push(currentPageHtml)
    }

    if (pages.length === 0) {
      pages.push('<p>Текст книги не найден или формат не поддерживается.</p>')
    }

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

    const chunkSize = 1000
    for (let i = 0; i < pagesToInsert.length; i += chunkSize) {
      await db.insert(schema.bookPages).values(pagesToInsert.slice(i, i + chunkSize)).onConflictDoNothing()
    }

    await db.insert(schema.readingProgress).values({
      bookId,
      userId,
      currentPage: 1,
    }).onConflictDoNothing()

    if (UPLOAD_STORAGE !== 's3') {
      await unlink(filePath).catch(() => {})
    }
    return bookId
  }
  catch (error) {
    if (UPLOAD_STORAGE !== 's3') {
      await unlink(filePath).catch(() => {})
    }
    throw error
  }
}
