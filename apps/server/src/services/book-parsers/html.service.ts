import type { CheerioAPI } from 'cheerio'
import type { AnyNode, Element } from 'domhandler'
import type { TocItem } from '../../types'
import { unlink } from 'node:fs/promises'
import * as cheerio from 'cheerio'
import {
  decodeTextBuffer,
  detectLanguageFromText,
  escapeHtml,
  HtmlPageBuilder,
  insertParsedBookToDb,
} from './book-parser.utils'

export interface ParsedHtmlBook {
  title: string
  author: string | null
  language: string
  pages: string[]
  toc: TocItem[]
}

const HEADING_TAGS = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6'])

const BLOCK_TAGS = new Set([
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'p',
  'blockquote',
  'pre',
  'ul',
  'ol',
  'table',
  'hr',
  'div',
  'section',
  'article',
  'main',
  'header',
  'figure',
  'figcaption',
  'dl',
  'dt',
  'dd',
  'details',
  'summary',
  'address',
  'center',
  'body',
])

const INLINE_FORMATTING_TAGS = new Set([
  'strong',
  'b',
  'em',
  'i',
  'u',
  's',
  'del',
  'ins',
  'sub',
  'sup',
  'code',
  'mark',
  'small',
  'q',
  'cite',
  'abbr',
  'time',
])

function isElementNode(node: AnyNode): node is Element {
  return node.type === 'tag'
}

function isAllowedImageSrc(src: string | undefined): src is string {
  if (!src)
    return false

  const trimmed = src.trim()

  return /^data:image\/[a-z0-9.+-]+;base64,/i.test(trimmed)
    || /^https?:\/\/[^\s"'<>]+$/i.test(trimmed)
}

function isAllowedHref(href: string | undefined): href is string {
  if (!href)
    return false

  const trimmed = href.trim()

  return /^https?:\/\/[^\s"'<>]+$/i.test(trimmed)
    || /^#[\w-]+$/.test(trimmed)
}

function detectExplicitCharset(bytes: Uint8Array): string | undefined {
  const headLen = Math.min(bytes.length, 2048)
  let asciiHead = ''

  for (let i = 0; i < headLen; i++) {
    asciiHead += String.fromCharCode(bytes[i])
  }

  const metaCharsetMatch = asciiHead.match(/<meta[^>]+charset\s*=\s*["']?([\w-]+)/i)

  if (metaCharsetMatch?.[1]) {
    return metaCharsetMatch[1]
  }

  const xmlEncodingMatch = asciiHead.match(/<\?xml[^>]+encoding\s*=\s*["']([\w-]+)["']/i)

  if (xmlEncodingMatch?.[1]) {
    return xmlEncodingMatch[1]
  }

  return undefined
}

function renderInlineNode($: CheerioAPI, node: AnyNode): { html: string, text: string } {
  if (node.type === 'text') {
    const raw = $(node).text().replace(/\s+/g, ' ')

    return {
      html: escapeHtml(raw),
      text: raw,
    }
  }

  if (!isElementNode(node)) {
    return { html: '', text: '' }
  }

  const tag = node.tagName.toLowerCase()

  if (tag === 'br') {
    return { html: '<br/>', text: '\n' }
  }

  if (tag === 'img') {
    const src = $(node).attr('src')

    if (!isAllowedImageSrc(src)) {
      return { html: '', text: '' }
    }

    const alt = $(node).attr('alt')?.trim()
    const altAttr = alt ? ` alt="${escapeHtml(alt)}"` : ''

    return {
      html: `<img src="${escapeHtml(src.trim())}"${altAttr} />`,
      text: alt || '',
    }
  }

  let childHtml = ''
  let childText = ''

  $(node).contents().each((_, child) => {
    const rendered = renderInlineNode($, child)
    childHtml += rendered.html
    childText += rendered.text
  })

  if (!childHtml)
    return { html: '', text: '' }

  if (tag === 'a') {
    const href = $(node).attr('href')

    if (isAllowedHref(href)) {
      return {
        html: `<a href="${escapeHtml(href.trim())}">${childHtml}</a>`,
        text: childText,
      }
    }

    return { html: childHtml, text: childText }
  }

  if (INLINE_FORMATTING_TAGS.has(tag)) {
    return {
      html: `<${tag}>${childHtml}</${tag}>`,
      text: childText,
    }
  }

  return { html: childHtml, text: childText }
}

function renderInlineChildren($: CheerioAPI, el: Element): { html: string, text: string } {
  let html = ''
  let text = ''

  $(el).contents().each((_, child) => {
    const rendered = renderInlineNode($, child)
    html += rendered.html
    text += rendered.text
  })

  return {
    html: html.trim(),
    text: text.replace(/\s+/g, ' ').trim(),
  }
}

function renderList($: CheerioAPI, listEl: Element, tag: 'ul' | 'ol'): { html: string, text: string } {
  let itemsHtml = ''
  let itemsText = ''

  $(listEl).children('li').each((_, liEl) => {
    let liHtml = ''
    let liText = ''

    $(liEl).contents().each((__, child) => {
      if (isElementNode(child)) {
        const cTag = child.tagName.toLowerCase()

        if (cTag === 'ul' || cTag === 'ol') {
          const nested = renderList($, child, cTag)
          liHtml += nested.html
          liText += ` ${nested.text}`

          return
        }
      }

      const rendered = renderInlineNode($, child)
      liHtml += rendered.html
      liText += rendered.text
    })

    const trimmedHtml = liHtml.trim()
    const trimmedText = liText.replace(/\s+/g, ' ').trim()

    if (trimmedText || trimmedHtml.includes('<img ')) {
      itemsHtml += `<li>${trimmedHtml}</li>`
      itemsText += `${trimmedText} `
    }
  })

  if (!itemsHtml)
    return { html: '', text: '' }

  return {
    html: `<${tag}>${itemsHtml}</${tag}>\n`,
    text: itemsText.trim(),
  }
}

function renderTable($: CheerioAPI, tableEl: Element): { html: string, text: string } {
  let rowsHtml = ''
  let tableText = ''

  $(tableEl).find('tr').each((_, trEl) => {
    let cellsHtml = ''

    $(trEl).children('th, td').each((__, cellEl) => {
      if (!isElementNode(cellEl))
        return

      const cellTag = cellEl.tagName.toLowerCase() === 'th' ? 'th' : 'td'
      const { html, text } = renderInlineChildren($, cellEl)

      if (text || html.includes('<img ')) {
        cellsHtml += `<${cellTag}>${html}</${cellTag}>`
        tableText += `${text} `
      }
      else {
        cellsHtml += `<${cellTag}></${cellTag}>`
      }
    })

    if (cellsHtml) {
      rowsHtml += `<tr>${cellsHtml}</tr>`
    }
  })

  if (!rowsHtml || !tableText.trim())
    return { html: '', text: '' }

  return {
    html: `<table>${rowsHtml}</table>\n`,
    text: tableText.trim(),
  }
}

export function parseHtmlBuffer(bytes: Uint8Array, filename: string): ParsedHtmlBook {
  const explicitCharset = detectExplicitCharset(bytes)
  const htmlString = decodeTextBuffer(bytes, explicitCharset)
  const $ = cheerio.load(htmlString)

  const fallbackTitle = filename.replace(/\.(?:html|htm)$/i, '') || 'HTML Book'
  const ogTitle = $('meta[property="og:title"]').attr('content')?.trim()
  const twitterTitle = $('meta[name="twitter:title"]').attr('content')?.trim()
  const docTitle = $('title').first().text().replace(/\s+/g, ' ').trim()

  const metaAuthor = $('meta[name="author"]').attr('content')?.trim()
    || $('meta[property="article:author"]').attr('content')?.trim()
    || $('[rel="author"]').first().text().replace(/\s+/g, ' ').trim()
  const author = metaAuthor || null

  let metaLang = $('html').attr('lang')?.trim()

  if (!metaLang) {
    $('meta').each((_, el) => {
      const httpEquiv = $(el).attr('http-equiv')?.toLowerCase()

      if (httpEquiv === 'content-language') {
        const content = $(el).attr('content')?.trim()

        if (content) {
          metaLang = content
        }
      }
    })
  }

  // Remove noise elements before extracting first h1 and body content
  $('script, style, noscript, iframe, svg, canvas, nav, footer, form, button, input, select, textarea, aside, [aria-hidden="true"]').remove()

  const firstH1 = $('h1').first().text().replace(/\s+/g, ' ').trim()
  const title = ogTitle || twitterTitle || docTitle || firstH1 || fallbackTitle

  // Select main root container
  const candidates = [$('article').first(), $('main').first(), $('[role="main"]').first(), $('body').first()]
  let rootNodes: AnyNode[] = $.root().contents().toArray()

  for (const candidate of candidates) {
    if (candidate.length > 0 && (candidate.text().trim().length > 0 || candidate.find('img').length > 0)) {
      rootNodes = candidate.contents().toArray()
      break
    }
  }

  const pageBuilder = new HtmlPageBuilder()
  const toc: TocItem[] = []
  let tocOrder = 0
  let textSample = ''

  const appendSample = (text: string) => {
    if (text && textSample.length < 6000) {
      textSample += `${text} `
    }
  }

  const traverseNodes = (nodes: AnyNode[]) => {
    let inlineHtmlBuf = ''
    let inlineTextBuf = ''

    const flushInlineBuffer = () => {
      const html = inlineHtmlBuf.trim()
      const text = inlineTextBuf.replace(/\s+/g, ' ').trim()
      inlineHtmlBuf = ''
      inlineTextBuf = ''

      if (!text && !html.includes('<img '))
        return

      appendSample(text)
      pageBuilder.pushBlock(`<p>${html}</p>\n`, text.length || 1)
    }

    for (const node of nodes) {
      if (node.type === 'text') {
        const rendered = renderInlineNode($, node)
        inlineHtmlBuf += rendered.html
        inlineTextBuf += rendered.text
        continue
      }

      if (!isElementNode(node))
        continue

      const tag = node.tagName.toLowerCase()

      if (!BLOCK_TAGS.has(tag)) {
        const rendered = renderInlineNode($, node)
        inlineHtmlBuf += rendered.html
        inlineTextBuf += rendered.text
        continue
      }

      flushInlineBuffer()

      if (HEADING_TAGS.has(tag)) {
        const { html, text } = renderInlineChildren($, node)

        if (!text)
          continue

        appendSample(text)
        const level = Number.parseInt(tag.slice(1), 10)
        const pageNum = pageBuilder.getPageNumForNextBlock(text.length)
        const order = tocOrder++

        toc.push({
          id: `sec-${order}`,
          href: '',
          title: text,
          order,
          level,
          pageNum,
        })

        pageBuilder.pushBlock(`<${tag}>${html}</${tag}>\n`, text.length)
      }
      else if (tag === 'p') {
        const { html, text } = renderInlineChildren($, node)

        if (!text && !html.includes('<img '))
          continue

        appendSample(text)
        pageBuilder.pushBlock(`<p>${html}</p>\n`, text.length || 1)
      }
      else if (tag === 'blockquote') {
        const { html, text } = renderInlineChildren($, node)

        if (!text && !html.includes('<img '))
          continue

        appendSample(text)
        pageBuilder.pushBlock(`<blockquote>${html}</blockquote>\n`, text.length || 1)
      }
      else if (tag === 'pre') {
        const rawCode = $(node).text().replace(/\r\n?/g, '\n').trim()

        if (!rawCode)
          continue

        appendSample(rawCode)
        pageBuilder.pushBlock(`<pre>${escapeHtml(rawCode)}</pre>\n`, rawCode.length)
      }
      else if (tag === 'ul' || tag === 'ol') {
        const { html, text } = renderList($, node, tag)

        if (!html)
          continue

        appendSample(text)
        pageBuilder.pushBlock(html, text.length || 1)
      }
      else if (tag === 'table') {
        const { html, text } = renderTable($, node)

        if (!html)
          continue

        appendSample(text)
        pageBuilder.pushBlock(html, text.length || 1)
      }
      else if (tag === 'hr') {
        pageBuilder.pushBlock('<hr/>\n', 1)
      }
      else {
        // Container tag (div, section, article, main, figure, etc.)
        traverseNodes($(node).contents().toArray())
      }
    }

    flushInlineBuffer()
  }

  traverseNodes(rootNodes)

  const pages = pageBuilder.finalize()
  const language = detectLanguageFromText(textSample, metaLang)

  return {
    title,
    author,
    language,
    pages,
    toc,
  }
}

export async function processHtml(filePath: string, filename: string, userId: number): Promise<number> {
  try {
    const bytes = await Bun.file(filePath).bytes()
    const parsed = parseHtmlBuffer(bytes, filename)

    return await insertParsedBookToDb({
      userId,
      type: 'html',
      title: parsed.title,
      author: parsed.author,
      filePath,
      language: parsed.language,
      pages: parsed.pages,
      toc: parsed.toc,
    })
  }
  finally {
    await unlink(filePath).catch(() => {})
  }
}
