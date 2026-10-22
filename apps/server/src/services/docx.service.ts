import type { CheerioAPI } from 'cheerio'
import type { Element } from 'domhandler'
import type { TocItem } from '../types'
import { unlink } from 'node:fs/promises'
import AdmZip from 'adm-zip'
import * as cheerio from 'cheerio'
import { normalizeLanguageCode } from '~/utils/helpers'
import { PAGE_SIZE_CHARS } from '../config'
import { db } from '../db'
import * as schema from '../db/schema'
import { storageService } from './storage.service'

const IGNORED_CREATORS = new Set([
  'ipad',
  'iphone',
  'user',
  'admin',
  'administrator',
  'windows user',
  'microsoft office user',
])

interface StyleInfo {
  name: string
  headingLevel: number | null
}

export interface ParsedDocxBook {
  title: string
  author: string | null
  language: string
  pages: string[]
  toc: TocItem[]
  thumbnail?: {
    buffer: Buffer
    mime: string
  } | null
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function getMimeTypeFromPath(entryPath: string): string {
  const lower = entryPath.toLowerCase()

  if (lower.endsWith('.png'))
    return 'image/png'

  if (lower.endsWith('.webp'))
    return 'image/webp'

  if (lower.endsWith('.gif'))
    return 'image/gif'

  if (lower.endsWith('.svg'))
    return 'image/svg+xml'

  return 'image/jpeg'
}

function parseStyles(stylesXml: string): Map<string, StyleInfo> {
  const map = new Map<string, StyleInfo>()

  if (!stylesXml)
    return map

  const $ = cheerio.load(stylesXml, { xmlMode: true })

  $('w\\:style').each((_, el) => {
    const styleId = $(el).attr('w:styleId')

    if (!styleId)
      return

    const name = $(el).find('w\\:name').attr('w:val') || styleId
    const outlineVal = $(el).find('w\\:pPr w\\:outlineLvl').attr('w:val')
    let headingLevel: number | null = null

    if (outlineVal !== undefined) {
      const parsed = Number.parseInt(outlineVal, 10)

      if (!Number.isNaN(parsed) && parsed >= 0 && parsed <= 5) {
        headingLevel = parsed + 1
      }
    }

    if (headingLevel === null) {
      const headingMatch = name.match(/^(?:heading|заголовок|标题)\s*(\d+)/i)
        || styleId.match(/^(?:heading|заголовок)(\d+)/i)

      if (headingMatch) {
        const lvl = Number.parseInt(headingMatch[1], 10)

        if (lvl >= 1 && lvl <= 6) {
          headingLevel = lvl
        }
      }
      else if (/^(?:title|subtitle)$/i.test(name)) {
        headingLevel = name.toLowerCase() === 'title' ? 1 : 2
      }
    }

    map.set(styleId, { name, headingLevel })
  })

  return map
}

function parseRelationships(relsXml: string): Map<string, string> {
  const rels = new Map<string, string>()

  if (!relsXml)
    return rels

  const $ = cheerio.load(relsXml, { xmlMode: true })

  $('Relationship').each((_, el) => {
    const id = $(el).attr('Id')
    const target = $(el).attr('Target')

    if (id && target) {
      rels.set(id, target)
    }
  })

  return rels
}

function detectLanguageFromTextAndMeta(textSample: string, metaLang: string, runLangs: Map<string, number>): string {
  const cyrillicCount = (textSample.match(/\p{Script=Cyrillic}/gu) || []).length
  const hanCount = (textSample.match(/\p{Script=Han}/gu) || []).length
  const kanaCount = (textSample.match(/[\p{Script=Hiragana}\p{Script=Katakana}]/gu) || []).length
  const hangulCount = (textSample.match(/\p{Script=Hangul}/gu) || []).length
  const latinCount = (textSample.match(/\p{Script=Latin}/gu) || []).length

  const totalLetters = cyrillicCount + hanCount + kanaCount + hangulCount + latinCount

  if (totalLetters > 20) {
    if (kanaCount > 5 && (kanaCount + hanCount) / totalLetters > 0.3)
      return 'ja'

    if (hanCount / totalLetters > 0.3)
      return 'zh'

    if (hangulCount / totalLetters > 0.3)
      return 'ko'

    if (cyrillicCount / totalLetters > 0.3) {
      const normalizedMeta = normalizeLanguageCode(metaLang)

      if (['ru', 'uk', 'be', 'bg'].includes(normalizedMeta))
        return normalizedMeta

      return 'ru'
    }
  }

  if (metaLang) {
    const normalized = normalizeLanguageCode(metaLang)

    if (normalized)
      return normalized
  }

  let topLang = ''
  let topCount = 0

  for (const [lang, count] of runLangs.entries()) {
    if (count > topCount) {
      topLang = lang
      topCount = count
    }
  }

  if (topLang) {
    const normalized = normalizeLanguageCode(topLang)

    if (normalized)
      return normalized
  }

  return cyrillicCount > latinCount ? 'ru' : 'en'
}

function isAttrDisabled(val: string | undefined): boolean {
  return val === '0' || val === 'false' || val === 'none'
}

export function parseDocxFile(filePath: string, filename: string): ParsedDocxBook {
  const zip = new AdmZip(filePath)

  const docEntry = zip.getEntry('word/document.xml')

  if (!docEntry) {
    throw new Error('Invalid .docx file: word/document.xml not found')
  }

  const coreXml = zip.getEntry('docProps/core.xml')?.getData().toString('utf-8') || ''
  const stylesXml = zip.getEntry('word/styles.xml')?.getData().toString('utf-8') || ''
  const relsXml = zip.getEntry('word/_rels/document.xml.rels')?.getData().toString('utf-8') || ''
  const docXml = docEntry.getData().toString('utf-8')

  const $core = cheerio.load(coreXml, { xmlMode: true })
  const rawTitle = $core('dc\\:title').first().text().trim()
  const title = rawTitle || filename.replace(/\.docx$/i, '')

  const rawCreator = $core('dc\\:creator').first().text().trim()
  const author = rawCreator && !IGNORED_CREATORS.has(rawCreator.toLowerCase())
    ? rawCreator
    : null

  const metaLang = $core('dc\\:language').first().text().trim()

  const stylesMap = parseStyles(stylesXml)
  const relsMap = parseRelationships(relsXml)

  const zipEntriesMap = new Map<string, AdmZip.IZipEntry>()

  for (const entry of zip.getEntries()) {
    zipEntriesMap.set(entry.entryName, entry)
  }

  const resolveImageEntry = (rId: string): { buffer: Buffer, mime: string } | null => {
    const target = relsMap.get(rId)

    if (!target)
      return null

    const normalizedTarget = target.replace(/^\/+/, '')
    const candidates = [
      `word/${normalizedTarget}`,
      normalizedTarget,
    ]

    for (const candidate of candidates) {
      const entry = zipEntriesMap.get(candidate)

      if (entry) {
        return {
          buffer: entry.getData(),
          mime: getMimeTypeFromPath(candidate),
        }
      }
    }

    return null
  }

  let thumbnail: { buffer: Buffer, mime: string } | null = null
  const thumbEntry = zip.getEntries().find(e => /^docProps\/thumbnail\.(?:jpe?g|png|webp)$/i.test(e.entryName))

  if (thumbEntry) {
    thumbnail = {
      buffer: thumbEntry.getData(),
      mime: getMimeTypeFromPath(thumbEntry.entryName),
    }
  }

  const $ = cheerio.load(docXml, { xmlMode: true })
  const runLangs = new Map<string, number>()

  $('w\\:lang').each((_, el) => {
    const val = $(el).attr('w:val') || $(el).attr('w:eastAsia')

    if (val) {
      runLangs.set(val, (runLangs.get(val) || 0) + 1)
    }
  })

  const renderRun = ($doc: CheerioAPI, runEl: Element): { html: string, text: string } => {
    let runHtml = ''
    let runText = ''

    const $run = $doc(runEl)

    $run.children().each((_, child) => {
      const tag = child.tagName

      if (tag === 'w:t') {
        const t = $doc(child).text()
        runText += t
        runHtml += escapeHtml(t)
      }
      else if (tag === 'w:tab') {
        runText += ' '
        runHtml += ' '
      }
      else if (tag === 'w:br' || tag === 'w:cr') {
        runText += '\n'
        runHtml += '<br/>'
      }
      else if (tag === 'w:drawing' || tag === 'w:pict' || tag === 'mc:AlternateContent') {
        const blipEmbed = $doc(child).find('a\\:blip').first().attr('r:embed')
          || $doc(child).find('v\\:imagedata').first().attr('r:id')

        if (blipEmbed) {
          const imgData = resolveImageEntry(blipEmbed)

          if (imgData) {
            const b64 = imgData.buffer.toString('base64')
            runHtml += `<img src="data:${imgData.mime};base64,${b64}" />`
          }
        }
      }
    })

    if (!runHtml)
      return { html: '', text: '' }

    if (runText.trim().length > 0) {
      const rPr = $run.children('w\\:rPr')

      if (rPr.length) {
        const b = rPr.children('w\\:b')
        const i = rPr.children('w\\:i')
        const u = rPr.children('w\\:u')

        if (u.length && !isAttrDisabled(u.attr('w:val'))) {
          runHtml = `<u>${runHtml}</u>`
        }

        if (i.length && !isAttrDisabled(i.attr('w:val'))) {
          runHtml = `<em>${runHtml}</em>`
        }

        if (b.length && !isAttrDisabled(b.attr('w:val'))) {
          runHtml = `<strong>${runHtml}</strong>`
        }
      }
    }

    return { html: runHtml, text: runText }
  }

  const extractInlineContainer = ($doc: CheerioAPI, container: Element): { html: string, text: string } => {
    let html = ''
    let text = ''

    $doc(container).children().each((_, child) => {
      const tag = child.tagName

      if (tag === 'w:r') {
        const res = renderRun($doc, child)
        html += res.html
        text += res.text
      }
      else if (tag === 'w:hyperlink' || tag === 'w:ins' || tag === 'w:smartTag' || tag === 'w:sdt' || tag === 'w:sdtContent') {
        const res = extractInlineContainer($doc, child)
        html += res.html
        text += res.text
      }
    })

    return { html, text }
  }

  const getParagraphHeadingLevel = ($doc: CheerioAPI, pEl: Element): number | null => {
    const pPr = $doc(pEl).children('w\\:pPr')

    if (!pPr.length)
      return null

    const outlineVal = pPr.children('w\\:outlineLvl').attr('w:val')

    if (outlineVal !== undefined) {
      const parsed = Number.parseInt(outlineVal, 10)

      if (!Number.isNaN(parsed) && parsed >= 0 && parsed <= 5) {
        return parsed + 1
      }
    }

    const styleId = pPr.children('w\\:pStyle').attr('w:val')

    if (styleId) {
      const styleInfo = stylesMap.get(styleId)

      if (styleInfo?.headingLevel) {
        return styleInfo.headingLevel
      }
    }

    return null
  }

  const pages: string[] = []
  let currentPageHtml = ''
  let currentLen = 0
  const toc: TocItem[] = []
  let tocOrder = 0
  let textSample = ''

  const pushBlock = (blockHtml: string, textLen: number) => {
    if (!blockHtml)
      return

    if (currentLen > 0 && currentLen + textLen >= PAGE_SIZE_CHARS) {
      pages.push(currentPageHtml)
      currentPageHtml = ''
      currentLen = 0
    }

    currentPageHtml += blockHtml
    currentLen += textLen
  }

  const body = $('w\\:body').first()

  body.children().each((_, el) => {
    const tag = el.tagName

    if (tag === 'w:p') {
      const { html, text } = extractInlineContainer($, el)
      const trimmedText = text.replace(/\u00A0/g, ' ').trim()
      const hasImage = html.includes('<img ')

      if (!trimmedText && !hasImage)
        return

      if (textSample.length < 4000 && trimmedText) {
        textSample += `${trimmedText} `
      }

      const headingLevel = getParagraphHeadingLevel($, el)

      if (headingLevel !== null && trimmedText) {
        const currentOrder = tocOrder++
        toc.push({
          id: `sec-${currentOrder}`,
          href: '',
          title: trimmedText,
          order: currentOrder,
          level: headingLevel,
          pageNum: (currentLen > 0 && currentLen + trimmedText.length >= PAGE_SIZE_CHARS)
            ? pages.length + 2
            : pages.length + 1,
        })

        const hTag = `h${Math.min(Math.max(headingLevel, 1), 6)}`
        pushBlock(`<${hTag}>${html}</${hTag}>\n`, trimmedText.length)
      }
      else {
        pushBlock(`<p>${html}</p>\n`, trimmedText.length || 1)
      }
    }
    else if (tag === 'w:tbl') {
      let tableHtml = '<table>'
      let tableTextLen = 0

      $(el).find('w\\:tr').each((__, trEl) => {
        tableHtml += '<tr>'
        $(trEl).find('w\\:tc').each((___, tcEl) => {
          let cellHtml = ''
          $(tcEl).find('w\\:p').each((____, pEl) => {
            const { html, text } = extractInlineContainer($, pEl)
            const trimmed = text.replace(/\u00A0/g, ' ').trim()

            if (trimmed || html.includes('<img ')) {
              cellHtml += cellHtml ? `<br/>${html}` : html
              tableTextLen += trimmed.length
            }
          })
          tableHtml += `<td>${cellHtml}</td>`
        })
        tableHtml += '</tr>'
      })

      tableHtml += '</table>\n'

      if (tableTextLen > 0) {
        pushBlock(tableHtml, tableTextLen)
      }
    }
  })

  if (currentPageHtml.trim()) {
    pages.push(currentPageHtml)
  }

  if (pages.length === 0) {
    pages.push('<p>Текст книги не найден или формат не поддерживается.</p>')
  }

  const language = detectLanguageFromTextAndMeta(textSample, metaLang, runLangs)

  return {
    title,
    author,
    language,
    pages,
    toc,
    thumbnail,
  }
}

export async function processDocx(filePath: string, filename: string, userId: number): Promise<number> {
  try {
    const parsed = parseDocxFile(filePath, filename)

    let coverUrl: string | null = null

    if (parsed.thumbnail) {
      const ext = parsed.thumbnail.mime.includes('png') ? '.png' : '.jpg'
      const coverFilename = `${Date.now()}_cover${ext}`
      await storageService.uploadFile(`covers/${coverFilename}`, parsed.thumbnail.buffer, parsed.thumbnail.mime)
      coverUrl = `/api/uploads/covers/${coverFilename}`
    }

    const bookId = await db.transaction(async (tx) => {
      const [insertedBook] = await tx.insert(schema.books).values({
        userId,
        type: 'docx',
        title: parsed.title,
        author: parsed.author,
        coverUrl,
        filePath,
        language: parsed.language,
        totalPages: parsed.pages.length,
        toc: JSON.stringify(parsed.toc),
      }).returning({ id: schema.books.id })

      const bId = insertedBook.id

      const pagesToInsert = parsed.pages.map((content, idx) => ({
        bookId: bId,
        pageNum: idx + 1,
        content,
      }))

      const chunkSize = 1000

      for (let i = 0; i < pagesToInsert.length; i += chunkSize) {
        await tx.insert(schema.bookPages).values(pagesToInsert.slice(i, i + chunkSize)).onConflictDoNothing()
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
