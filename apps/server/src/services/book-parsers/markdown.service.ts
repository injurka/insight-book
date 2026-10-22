import type { TocItem } from '../../types'
import type { ParsedTextBook } from './txt.service'
import { unlink } from 'node:fs/promises'
import * as cheerio from 'cheerio'
import {
  decodeTextBuffer,
  detectLanguageFromText,
  HtmlPageBuilder,
  insertParsedBookToDb,
} from './book-parser.utils'

export type { ParsedTextBook }

interface BunWithMarkdown {
  markdown: {
    html: (input: string, options?: Record<string, boolean>) => string
  }
}

function renderMarkdownToHtml(markdown: string): string {
  const bunWithMd = Bun as unknown as BunWithMarkdown

  return bunWithMd.markdown.html(markdown, {
    tables: true,
    strikethrough: true,
    tasklists: true,
    autolinks: true,
  })
}

interface FrontmatterData {
  title: string
  author: string | null
  lang: string | undefined
  body: string
}

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/

function parseFrontmatter(rawText: string): FrontmatterData {
  const match = rawText.match(FRONTMATTER_RE)

  if (!match) {
    return {
      title: '',
      author: null,
      lang: undefined,
      body: rawText,
    }
  }

  let title = ''
  let author: string | null = null
  let lang: string | undefined

  const fmLines = match[1].split(/\r?\n/)

  for (const line of fmLines) {
    const kvMatch = line.match(/^\s*([\w-]+)\s*:\s*(\S.*)$/)

    if (!kvMatch)
      continue

    const key = kvMatch[1].toLowerCase()
    const value = kvMatch[2].trim().replace(/^["'](.*)["']$/, '$1').trim()

    if (!value)
      continue

    if (key === 'title') {
      title = value
    }
    else if (key === 'author') {
      author = value
    }
    else if (key === 'lang' || key === 'language') {
      lang = value
    }
  }

  return {
    title,
    author,
    lang,
    body: rawText.slice(match[0].length),
  }
}

export function parseMarkdownBuffer(bytes: Uint8Array, filename: string): ParsedTextBook {
  const decoded = decodeTextBuffer(bytes)
  const { title: fmTitle, author, lang: fmLang, body } = parseFrontmatter(decoded)

  const rawHtml = renderMarkdownToHtml(body)
  const $ = cheerio.load(rawHtml)

  $('script, style, iframe').remove()

  const builder = new HtmlPageBuilder()
  const toc: TocItem[] = []
  let firstH1Title = ''
  let textSample = ''

  $('body').children().each((_, el) => {
    const tagName = el.tagName?.toLowerCase() || ''
    const blockText = $(el).text().trim()
    const blockHtml = `${$.html(el)}\n`

    if (!blockText && !blockHtml.includes('<img') && tagName !== 'hr')
      return

    const textLen = Math.max(blockText.length, 1)

    if (textSample.length < 6000 && blockText) {
      textSample += `${blockText} `
    }

    const headingMatch = tagName.match(/^h([1-6])$/)

    if (headingMatch && blockText) {
      const level = Number.parseInt(headingMatch[1], 10)

      if (!fmTitle && !firstH1Title && level === 1) {
        firstH1Title = blockText
      }

      const order = toc.length
      toc.push({
        id: `sec-${order}`,
        href: '',
        title: blockText,
        order,
        level,
        pageNum: builder.getPageNumForNextBlock(textLen),
      })
    }

    builder.pushBlock(blockHtml, textLen)
  })

  const fallbackTitle = filename.replace(/\.(?:md|markdown)$/i, '') || 'Untitled'
  const title = fmTitle || firstH1Title || fallbackTitle
  const pages = builder.finalize()
  const language = detectLanguageFromText(textSample || title, fmLang)

  return {
    title,
    author,
    language,
    pages,
    toc,
  }
}

export async function processMarkdown(filePath: string, filename: string, userId: number): Promise<number> {
  try {
    const bytes = await Bun.file(filePath).bytes()
    const parsed = parseMarkdownBuffer(bytes, filename)

    return await insertParsedBookToDb({
      userId,
      type: 'md',
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
