import type { TocItem } from '../../types'
import { unlink } from 'node:fs/promises'
import {
  decodeTextBuffer,
  detectLanguageFromText,
  escapeHtml,
  HtmlPageBuilder,
  insertParsedBookToDb,
} from './book-parser.utils'

export interface ParsedTextBook {
  title: string
  author: string | null
  language: string
  pages: string[]
  toc: TocItem[]
}

const TITLE_META_RE = /^(?:书名|名称|Title|Название|Заголовок)\s*[:：]\s*(\S.*)$/i
const AUTHOR_META_RE = /^(?:作者|Author|Автор)\s*[:：]\s*(\S.*)$/i
const BOOK_BRACKET_TITLE_RE = /^《([^》]+)》$/

const ZH_HEADING_RE = /^(?:第[零一二三四五六七八九十百千万两0-9]+[章节回卷集部篇]|楔子|序[言章幕]?|引子|尾声|番外|后记)(?:[\s:：、.—–-].*|$)/
const RU_HEADING_RE = /^(?:Глава|ГЛАВА|Часть|ЧАСТЬ|Раздел|РАЗДЕЛ|Книга|КНИГА|Том|ТОМ|Пролог|ПРОЛОГ|Эпилог|ЭПИЛОГ|Введение|Предисловие)(?:\s*[\dIVXLCDM]+)?(?:[.:—–\-\s].*)?$/
const EN_HEADING_RE = /^(?:Chapter|CHAPTER|Part|PART|Book|BOOK|Volume|VOLUME|Section|SECTION|Prologue|PROLOGUE|Epilogue|EPILOGUE|Introduction|Preface)(?:\s*[\dIVXLCDM]+)?(?:[.:—–\-\s].*)?$/
const MD_HEADING_RE = /^#{1,6}\s+(\S.*)$/

function detectTxtChapterHeading(trimmed: string): string | null {
  if (!trimmed)
    return null

  const mdMatch = trimmed.match(MD_HEADING_RE)

  if (mdMatch) {
    const headingText = mdMatch[1].trim()

    return headingText || null
  }

  if (trimmed.length <= 80 && ZH_HEADING_RE.test(trimmed)) {
    return trimmed
  }

  const endsWithSentencePeriod = trimmed.endsWith('.') && !/\d\.$/.test(trimmed)

  if (trimmed.length <= 100 && !endsWithSentencePeriod) {
    if (RU_HEADING_RE.test(trimmed) || EN_HEADING_RE.test(trimmed)) {
      return trimmed
    }
  }

  return null
}

export function parseTxtBuffer(bytes: Uint8Array, filename: string): ParsedTextBook {
  const decoded = decodeTextBuffer(bytes)
  const normalized = decoded.replace(/\r\n?/g, '\n')
  const lines = normalized.split('\n')

  let extractedTitle = ''
  let extractedAuthor: string | null = null
  let nonEmptyCount = 0

  const builder = new HtmlPageBuilder()
  const toc: TocItem[] = []
  let textSample = ''

  for (const rawLine of lines) {
    const trimmed = rawLine.replace(/^\s+|\s+$/g, '')

    if (!trimmed)
      continue

    if (nonEmptyCount < 15) {
      if (!extractedTitle) {
        if (nonEmptyCount === 0) {
          const bracketMatch = trimmed.match(BOOK_BRACKET_TITLE_RE)

          if (bracketMatch) {
            extractedTitle = bracketMatch[1].trim()
          }
        }

        if (!extractedTitle) {
          const titleMatch = trimmed.match(TITLE_META_RE)

          if (titleMatch) {
            extractedTitle = titleMatch[1].trim().replace(BOOK_BRACKET_TITLE_RE, '$1').trim()
          }
        }
      }

      if (!extractedAuthor) {
        const authorMatch = trimmed.match(AUTHOR_META_RE)

        if (authorMatch) {
          extractedAuthor = authorMatch[1].trim() || null
        }
      }
    }

    nonEmptyCount++

    if (textSample.length < 6000) {
      textSample += `${trimmed}\n`
    }

    const headingTitle = detectTxtChapterHeading(trimmed)

    if (headingTitle) {
      const order = toc.length
      toc.push({
        id: `sec-${order}`,
        href: '',
        title: headingTitle,
        order,
        level: 1,
        pageNum: builder.getPageNumForNextBlock(headingTitle.length),
      })
      builder.pushBlock(`<h2>${escapeHtml(headingTitle)}</h2>\n`, headingTitle.length)
    }
    else {
      builder.pushBlock(`<p>${escapeHtml(trimmed)}</p>\n`, trimmed.length)
    }
  }

  const fallbackTitle = filename.replace(/\.txt$/i, '') || 'Untitled'
  const title = extractedTitle || fallbackTitle
  const pages = builder.finalize()
  const language = detectLanguageFromText(textSample || title)

  return {
    title,
    author: extractedAuthor,
    language,
    pages,
    toc,
  }
}

export async function processTxt(filePath: string, filename: string, userId: number): Promise<number> {
  try {
    const bytes = await Bun.file(filePath).bytes()
    const parsed = parseTxtBuffer(bytes, filename)

    return await insertParsedBookToDb({
      userId,
      type: 'txt',
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
