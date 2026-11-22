import type { Element } from 'domhandler'
import type { TocItem } from '../../types'
import { unlink } from 'node:fs/promises'
import AdmZip from 'adm-zip'
import * as cheerio from 'cheerio'
import { normalizeLanguageCode } from '~/utils/helpers'
import { storageService } from '../storage.service'
import { decodeTextBuffer, escapeHtml, HtmlPageBuilder, insertParsedBookToDb, parseBookContent, unreadableBook } from './book-parser.utils'

async function readFb2(filePath: string, filename: string): Promise<Uint8Array> {
  const file = Bun.file(filePath)
  const prefix = new Uint8Array(await file.slice(0, 4).arrayBuffer())
  const isZip = prefix[0] === 0x50 && prefix[1] === 0x4B

  if (!isZip && !filename.toLowerCase().endsWith('.zip'))
    return file.bytes()

  const entries = new AdmZip(filePath).getEntries()
  const entry = entries.find(item => !item.isDirectory && /\.fb2$/i.test(item.entryName))
    ?? entries.find(item => !item.isDirectory && /\.xml$/i.test(item.entryName))

  if (!entry)
    throw unreadableBook('The archive contains no FB2 document')

  return entry.getData()
}

function parseFb2(bytes: Uint8Array, filename: string) {
  const prefix = new TextDecoder().decode(bytes.subarray(0, 256))
  const charset = prefix.match(/<\?xml\b[^>]+\bencoding\s*=\s*["']([^"']+)["']/i)?.[1]
  const $ = cheerio.load(decodeTextBuffer(bytes, charset), { xmlMode: true })
  const book = $.root().children('FictionBook').first()

  if (!book.length)
    throw unreadableBook('The XML is missing the FictionBook root element')

  const titleInfo = book.children('description').children('title-info')
  const title = titleInfo.children('book-title').text().trim() || filename.replace(/\.fb2(?:\.zip)?$/i, '')
  const author = titleInfo.children('author').toArray().map(node => ['first-name', 'middle-name', 'last-name', 'nickname']
    .map(tag => $(node).children(tag).text().trim())
    .filter(Boolean)
    .join(' ')).filter(Boolean).join(', ') || null
  const language = normalizeLanguageCode(titleInfo.children('lang').text().trim()) || 'ru'

  const images = new Map(book.children('binary').toArray().map((node) => {
    const image = $(node)

    return [image.attr('id'), {
      base64: image.text().trim(),
      mime: image.attr('content-type') || 'image/jpeg',
    }]
  }))

  function findImage(attributes: Record<string, string>) {
    const href = attributes['l:href'] ?? attributes['xlink:href'] ?? attributes.href
      ?? Object.entries(attributes).find(([name]) => name.endsWith(':href'))?.[1]

    return href?.startsWith('#') ? images.get(href.slice(1)) : undefined
  }

  const cover = findImage(titleInfo.find('coverpage > image').first().attr() ?? {})
  const builder = new HtmlPageBuilder()
  const toc: TocItem[] = []

  function visit(node: Element, level: number) {
    const item = $(node)
    const textLength = item.text().trim().length
    const html = item.html() || ''

    switch (node.tagName.toLowerCase()) {
      case 'section':
        item.children().each((_, child) => visit(child, level + 1))
        break
      case 'title': {
        const text = item.text().trim()

        if (text) {
          const order = toc.length
          const pageNum = builder.getPageNumForNextBlock(text.length)
          toc.push({
            id: `sec-${order}`,
            href: '',
            title: text,
            order,
            level,
            pageNum,
          })
          builder.pushBlock(`<h2>${escapeHtml(text)}</h2>\n`, text.length)
        }

        break
      }
      case 'image': {
        const image = findImage(node.attribs)

        if (image?.base64)
          builder.pushBlock(`<img src="data:${escapeHtml(image.mime)};base64,${escapeHtml(image.base64)}" />\n`, 0)

        break
      }
      case 'empty-line':
        builder.pushBlock('<br/>\n', 0)
        break
      case 'p':
      case 'v':
        if (textLength > 0)
          builder.pushBlock(`<p>${html}</p>\n`, textLength)

        break
      case 'subtitle':
      case 'cite':
      case 'poem':
      case 'epigraph':
      case 'annotation':
        if (textLength > 0)
          builder.pushBlock(`<div class="fb2-${node.tagName}">${html}</div>\n`, textLength)

        break
    }
  }

  book.children('body').each((_, body) => {
    $(body).children().each((_, node) => visit(node, 0))
  })

  return {
    title,
    author,
    language,
    cover,
    toc,
    pages: builder.finalize(),
  }
}

export async function processFb2(filePath: string, filename: string, userId: number): Promise<number> {
  let coverKey: string | undefined

  try {
    const bytes = await parseBookContent(() => readFb2(filePath, filename))
    const { cover, ...book } = parseFb2(bytes, filename)

    if (cover?.base64) {
      const ext = cover.mime.includes('png') ? '.png' : '.jpg'
      coverKey = `covers/${crypto.randomUUID()}${ext}`
      await storageService.uploadFile(coverKey, Buffer.from(cover.base64, 'base64'), cover.mime)
    }

    return await insertParsedBookToDb({
      ...book,
      userId,
      type: 'fb2',
      filePath,
      coverUrl: coverKey ? `/api/uploads/${coverKey}` : null,
    })
  }
  catch (error) {
    if (coverKey)
      await storageService.deleteFile(coverKey).catch(() => {})

    throw error
  }
  finally {
    await unlink(filePath).catch(() => {})
  }
}
