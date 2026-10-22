import type { TocItem } from '../../types'
import { unlink } from 'node:fs/promises'
import { getDocumentProxy, getMeta } from 'unpdf'
import {
  detectLanguageFromText,
  escapeHtml,
  HtmlPageBuilder,
  insertParsedBookToDb,
} from './book-parser.utils'

export interface ParsedPdfBook {
  title: string
  author: string | null
  language: string
  pages: string[]
  toc: TocItem[]
}

interface PdfTextItem {
  str: string
  dir: string
  transform: number[]
  width: number
  height: number
  fontName: string
  hasEOL: boolean
}

interface PositionedSpan {
  str: string
  x: number
  y: number
  width: number
  height: number
  hasEOL: boolean
}

interface ReconstructedLine {
  text: string
  y: number
  height: number
  pageIdx: number
}

const IGNORED_TITLES = new Set([
  'untitled',
  'document',
  'slide 1',
  'unknown',
  'none',
])

const IGNORED_AUTHORS = new Set([
  'admin',
  'administrator',
  'user',
  'unknown',
  'ipad',
  'iphone',
  'windows user',
  'microsoft office user',
])

const PAGE_NUMBER_LINE_RE = /^(?:(?:[-—–]\s*)?\d+(?:\s*[-—–])?|(?:page|стр\.?)\s*\d+)$/i
const CHAPTER_HEADING_RE = /^(?:第[零一二三四五六七八九十百千万0-9]+[章节回卷部篇]|(?:Глава|ГЛАВА|Часть|ЧАСТЬ|Раздел|РАЗДЕЛ|Chapter|CHAPTER|Part|PART|Section|SECTION)\s+[\dIVXLCDM]+|Пролог|ПРОЛОГ|Эпилог|ЭПИЛОГ|Введение|Заключение|Prologue|PROLOGUE|Epilogue|EPILOGUE|Introduction|INTRODUCTION)(?:\b|\s|$|[:.])/u
const TERMINAL_PUNCTUATION_RE = /[.!?。！？…”»"':：]$/u
const CJK_END_RE = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]$/u
const CJK_START_RE = /^[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u

function isPdfTextItem(item: unknown): item is PdfTextItem {
  return typeof item === 'object'
    && item !== null
    && 'str' in item
    && typeof (item as { str: unknown }).str === 'string'
    && 'transform' in item
    && Array.isArray((item as { transform: unknown }).transform)
}

function cleanPdfTitle(rawTitle: string, filename: string): string {
  const fallback = filename.replace(/\.pdf$/i, '')

  if (!rawTitle)
    return fallback

  const cleaned = rawTitle
    .replace(/^Microsoft Word\s*-\s*/i, '')
    .replace(/\.(?:docx?|pdf|rtf|txt)$/i, '')
    .trim()

  if (!cleaned || IGNORED_TITLES.has(cleaned.toLowerCase()))
    return fallback

  return cleaned
}

function cleanPdfAuthor(rawAuthor: string): string | null {
  const cleaned = rawAuthor.trim()

  if (!cleaned || IGNORED_AUTHORS.has(cleaned.toLowerCase()))
    return null

  return cleaned
}

function reconstructPageLines(spans: PositionedSpan[], pageIdx: number): ReconstructedLine[] {
  if (spans.length === 0)
    return []

  const groups: PositionedSpan[][] = []

  for (const span of spans) {
    if (!span.str && !span.hasEOL)
      continue

    const lastGroup = groups[groups.length - 1]

    if (!lastGroup) {
      if (span.str.trim()) {
        groups.push([span])
      }

      continue
    }

    const refSpan = lastGroup[0]
    const prevSpan = lastGroup[lastGroup.length - 1]
    const tolerance = Math.max(2.5, Math.min(refSpan.height, span.height) * 0.45)
    const sameY = Math.abs(refSpan.y - span.y) <= tolerance

    if (sameY && !prevSpan.hasEOL) {
      lastGroup.push(span)
    }
    else if (span.str.trim()) {
      groups.push([span])
    }
  }

  // Sort lines top-to-bottom (higher Y is higher on the page in PDF space)
  groups.sort((a, b) => b[0].y - a[0].y)

  // Merge groups that ended up with identical Y after sorting if neither forced EOL
  const mergedGroups: PositionedSpan[][] = []

  for (const group of groups) {
    const prev = mergedGroups[mergedGroups.length - 1]

    if (prev) {
      const tolerance = Math.max(2.5, Math.min(prev[0].height, group[0].height) * 0.45)

      if (Math.abs(prev[0].y - group[0].y) <= tolerance && !prev[prev.length - 1].hasEOL) {
        prev.push(...group)
        continue
      }
    }

    mergedGroups.push(group)
  }

  const lines: ReconstructedLine[] = []

  for (const group of mergedGroups) {
    group.sort((a, b) => a.x - b.x)

    let rawText = ''
    let maxHeight = 0
    let ySum = 0

    for (let i = 0; i < group.length; i++) {
      const curr = group[i]
      maxHeight = Math.max(maxHeight, curr.height)
      ySum += curr.y

      if (i > 0) {
        const prev = group[i - 1]
        const prevEndsSpace = /\s$/.test(rawText)
        const currStartsSpace = /^\s/.test(curr.str)

        if (!prevEndsSpace && !currStartsSpace) {
          const expectedEnd = prev.width > 0 ? prev.x + prev.width : prev.x
          const gap = curr.x - expectedEnd
          const threshold = prev.width > 0
            ? Math.max(1.5, prev.height * 0.15)
            : prev.height * 0.6

          if (gap > threshold) {
            rawText += ' '
          }
        }
      }

      rawText += curr.str
    }

    const text = rawText.replace(/\s+/g, ' ').trim()

    if (text) {
      lines.push({
        text,
        y: ySum / group.length,
        height: maxHeight || 12,
        pageIdx,
      })
    }
  }

  // Filter out standalone page numbers at the very top or bottom of a page
  if (lines.length > 0 && PAGE_NUMBER_LINE_RE.test(lines[0].text)) {
    lines.shift()
  }

  if (lines.length > 0 && PAGE_NUMBER_LINE_RE.test(lines[lines.length - 1].text)) {
    lines.pop()
  }

  return lines
}

function computeMedianHeight(lines: ReconstructedLine[]): number {
  if (lines.length === 0)
    return 12

  const heights = lines.map(l => l.height).filter(h => h > 0).sort((a, b) => a - b)

  if (heights.length === 0)
    return 12

  const mid = Math.floor(heights.length / 2)

  return heights.length % 2 === 0
    ? (heights[mid - 1] + heights[mid]) / 2
    : heights[mid]
}

function isHeadingLine(line: ReconstructedLine, medianHeight: number): boolean {
  if (!line.text || line.text.length > 140)
    return false

  if (CHAPTER_HEADING_RE.test(line.text))
    return true

  if (line.height >= medianHeight * 1.25 && !/[.!?。！？]$/.test(line.text))
    return true

  return false
}

function joinLinesText(accumulated: string, nextLine: string): string {
  // Handle hyphenated word wraps across lines
  if (/\p{L}-\s*$/u.test(accumulated) && /^\p{Ll}/u.test(nextLine)) {
    return accumulated.replace(/-\s*$/, '') + nextLine
  }

  // CJK text joins without spaces
  if (CJK_END_RE.test(accumulated) && CJK_START_RE.test(nextLine)) {
    return accumulated + nextLine
  }

  return `${accumulated} ${nextLine}`
}

export async function parsePdfBuffer(bytes: Uint8Array, filename: string): Promise<ParsedPdfBook> {
  const pdf = await getDocumentProxy(new Uint8Array(bytes))

  try {
    const meta = await getMeta(pdf).catch(() => ({ info: {} as Record<string, unknown> }))
    const info = (meta.info ?? {}) as Record<string, unknown>

    const rawTitle = typeof info.Title === 'string' ? info.Title : ''
    const rawAuthor = typeof info.Author === 'string' ? info.Author : ''
    let rawLang = typeof info.Language === 'string' ? info.Language.trim() : ''

    const title = cleanPdfTitle(rawTitle, filename)
    const author = cleanPdfAuthor(rawAuthor)

    const allLines: ReconstructedLine[] = []

    for (let pageIdx = 1; pageIdx <= pdf.numPages; pageIdx++) {
      const page = await pdf.getPage(pageIdx)
      const textContent = await page.getTextContent()

      if (!rawLang && typeof textContent.lang === 'string' && textContent.lang.trim()) {
        rawLang = textContent.lang.trim()
      }

      const spans: PositionedSpan[] = []

      for (const rawItem of textContent.items) {
        if (!isPdfTextItem(rawItem))
          continue

        const x = Number(rawItem.transform[4]) || 0
        const y = Number(rawItem.transform[5]) || 0
        const transformHeight = Math.hypot(Number(rawItem.transform[2]) || 0, Number(rawItem.transform[3]) || 0)
          || Math.abs(Number(rawItem.transform[0]) || 0)
        const height = rawItem.height > 0 ? rawItem.height : (transformHeight || 12)

        spans.push({
          str: rawItem.str,
          x,
          y,
          width: rawItem.width || 0,
          height,
          hasEOL: Boolean(rawItem.hasEOL),
        })
      }

      const pageLines = reconstructPageLines(spans, pageIdx)
      allLines.push(...pageLines)
    }

    const medianHeight = computeMedianHeight(allLines)
    const pageBuilder = new HtmlPageBuilder()
    const toc: TocItem[] = []
    let textSample = ''

    let currentParagraph = ''
    let prevBodyLine: ReconstructedLine | null = null

    const flushParagraph = () => {
      const trimmed = currentParagraph.trim()

      if (!trimmed) {
        currentParagraph = ''
        prevBodyLine = null

        return
      }

      if (textSample.length < 6000) {
        textSample += `${trimmed} `
      }

      pageBuilder.pushBlock(`<p>${escapeHtml(trimmed)}</p>\n`, trimmed.length)
      currentParagraph = ''
      prevBodyLine = null
    }

    for (const line of allLines) {
      if (isHeadingLine(line, medianHeight)) {
        flushParagraph()

        if (textSample.length < 6000) {
          textSample += `${line.text} `
        }

        const order = toc.length
        const pageNum = pageBuilder.getPageNumForNextBlock(line.text.length)

        toc.push({
          id: `sec-${order}`,
          href: '',
          title: line.text,
          order,
          level: line.height >= medianHeight * 1.5 ? 1 : 2,
          pageNum,
        })

        pageBuilder.pushBlock(`<h2>${escapeHtml(line.text)}</h2>\n`, line.text.length)
        continue
      }

      if (!currentParagraph || !prevBodyLine) {
        currentParagraph = line.text
        prevBodyLine = line
        continue
      }

      const prevEndsWithTerminal = TERMINAL_PUNCTUATION_RE.test(prevBodyLine.text)
      const samePage = prevBodyLine.pageIdx === line.pageIdx
      const verticalGap = samePage ? Math.abs(prevBodyLine.y - line.y) : 0
      const maxLineHeight = Math.max(prevBodyLine.height, line.height)
      const isLargeVerticalGap = samePage && verticalGap > maxLineHeight * 1.85

      if (prevEndsWithTerminal || isLargeVerticalGap) {
        flushParagraph()
        currentParagraph = line.text
        prevBodyLine = line
      }
      else {
        currentParagraph = joinLinesText(currentParagraph, line.text)
        prevBodyLine = line
      }
    }

    flushParagraph()

    const pages = pageBuilder.finalize()
    const language = detectLanguageFromText(textSample, rawLang)

    return {
      title,
      author,
      language,
      pages,
      toc,
    }
  }
  finally {
    await Promise.resolve(pdf.cleanup()).catch(() => {})
  }
}

export async function processPdf(filePath: string, filename: string, userId: number): Promise<number> {
  try {
    const bytes = await Bun.file(filePath).bytes()
    const parsed = await parsePdfBuffer(bytes, filename)

    return await insertParsedBookToDb({
      userId,
      type: 'pdf',
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
