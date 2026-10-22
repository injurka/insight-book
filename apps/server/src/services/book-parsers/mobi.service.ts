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

export interface ParsedMobiBook {
  title: string
  author: string | null
  language: string
  pages: string[]
  toc: TocItem[]
}

const HEADING_TAGS = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6'])
const LEAF_BLOCK_TAGS = new Set(['p', 'blockquote', 'pre', 'li'])
const CONTAINER_TAGS = new Set(['body', 'div', 'section', 'article', 'main', 'header', 'footer', 'aside', 'center', 'ul', 'ol'])
const ALL_BLOCK_TAGS = new Set([...HEADING_TAGS, ...LEAF_BLOCK_TAGS, ...CONTAINER_TAGS, 'table', 'hr'])

function isElementNode(node: AnyNode): node is Element {
  return node.type === 'tag'
}

export function decompressPalmDocLz77(data: Uint8Array): Uint8Array {
  const out: number[] = []
  let i = 0

  while (i < data.length) {
    const b = data[i]

    if (b === 0x00) {
      out.push(0x00)
      i++
    }
    else if (b >= 0x01 && b <= 0x08) {
      const count = b
      i++

      for (let k = 0; k < count && i < data.length; k++, i++) {
        out.push(data[i])
      }
    }
    else if (b >= 0x09 && b <= 0x7F) {
      out.push(b)
      i++
    }
    else if (b >= 0x80 && b <= 0xBF) {
      if (i + 1 >= data.length)
        break

      const next = data[++i]
      const dist = (((b & 0x3F) << 8) | next) >> 3
      const len = (next & 0x07) + 3
      const start = out.length - dist

      for (let k = 0; k < len; k++) {
        const idx = start + k
        out.push(idx >= 0 && idx < out.length ? out[idx] : 0x20)
      }

      i++
    }
    else {
      // 0xC0..0xFF: space (0x20) followed by (b ^ 0x80)
      out.push(0x20, b ^ 0x80)
      i++
    }
  }

  return new Uint8Array(out)
}

function trimTrailingRecordData(record: Uint8Array, extraDataFlags: number): Uint8Array {
  if (extraDataFlags === 0 || record.length === 0)
    return record

  let end = record.length

  // Bits 1..15 represent trailing variable-length entries
  for (let flags = extraDataFlags >> 1; flags > 0; flags >>= 1) {
    if ((flags & 1) === 0)
      continue

    let size = 0
    let shift = 0
    let pos = end - 1

    while (pos >= 0 && shift < 28) {
      const byte = record[pos]
      size |= (byte & 0x7F) << shift
      pos--
      shift += 7

      if ((byte & 0x80) !== 0)
        break
    }

    if (size > 0 && size <= end) {
      end -= size
    }
  }

  // Bit 0 represents trailing multibyte character overlap
  if ((extraDataFlags & 1) !== 0 && end > 0) {
    const overlapCount = (record[end - 1] & 0x03) + 1

    if (overlapCount <= end) {
      end -= overlapCount
    }
  }

  return record.subarray(0, end)
}

function getEncodingName(textEncoding: number): string | undefined {
  if (textEncoding === 65001)
    return 'utf-8'

  if (textEncoding === 1252)
    return 'windows-1252'

  return undefined
}

function decodeCleanString(bytes: Uint8Array, charset?: string): string {
  return decodeTextBuffer(bytes, charset).replace(/\0+/g, '').trim()
}

export function parseMobiBuffer(bytes: Uint8Array, filename: string): ParsedMobiBook {
  if (bytes.byteLength < 78) {
    throw new Error('Invalid MOBI/PDB file: header is shorter than 78 bytes')
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const numRecords = view.getUint16(76, false)

  if (numRecords < 2 || 78 + numRecords * 8 > bytes.byteLength) {
    throw new Error('Invalid MOBI/PDB file: invalid record table')
  }

  const recordOffsets: number[] = []

  for (let i = 0; i < numRecords; i++) {
    recordOffsets.push(view.getUint32(78 + i * 8, false))
  }

  const getRecord = (index: number): Uint8Array => {
    const start = recordOffsets[index]
    const nextStart = index + 1 < recordOffsets.length ? recordOffsets[index + 1] : bytes.byteLength
    const safeStart = Math.min(Math.max(0, start), bytes.byteLength)
    const safeEnd = Math.min(Math.max(safeStart, nextStart), bytes.byteLength)

    return bytes.subarray(safeStart, safeEnd)
  }

  const rec0 = getRecord(0)

  if (rec0.byteLength < 16) {
    throw new Error('Invalid MOBI file: Record 0 is shorter than 16 bytes')
  }

  const rec0View = new DataView(rec0.buffer, rec0.byteOffset, rec0.byteLength)
  const compression = rec0View.getUint16(0, false)
  const textRecordCount = rec0View.getUint16(8, false)

  if (compression !== 1 && compression !== 2) {
    throw new Error(`Unsupported MOBI compression type: ${compression}`)
  }

  let charset: string | undefined = 'utf-8'
  let mobiFullName = ''
  let exthTitle = ''
  const exthAuthors: string[] = []
  let exthLanguage = ''
  let extraDataFlags = 0

  const hasMobiMagic = rec0.byteLength >= 20
    && rec0[16] === 0x4D // 'M'
    && rec0[17] === 0x4F // 'O'
    && rec0[18] === 0x42 // 'B'
    && rec0[19] === 0x49 // 'I'

  if (hasMobiMagic) {
    const headerLength = rec0View.getUint32(20, false)
    const textEncoding = rec0.byteLength >= 32 ? rec0View.getUint32(28, false) : 65001
    charset = getEncodingName(textEncoding)

    const fullNameOffset = rec0.byteLength >= 88 ? rec0View.getUint32(84, false) : 0
    const fullNameLength = rec0.byteLength >= 92 ? rec0View.getUint32(88, false) : 0

    if (fullNameOffset > 0 && fullNameLength > 0 && fullNameOffset + fullNameLength <= rec0.byteLength) {
      mobiFullName = decodeCleanString(rec0.subarray(fullNameOffset, fullNameOffset + fullNameLength), charset)
    }

    const exthFlags = rec0.byteLength >= 132 ? rec0View.getUint32(128, false) : 0

    if (headerLength >= 0xE4 && rec0.byteLength >= 244) {
      extraDataFlags = rec0View.getUint16(242, false)
    }

    const exthOffset = 16 + headerLength

    if ((exthFlags & 0x40) !== 0 && exthOffset + 12 <= rec0.byteLength) {
      const isExthMagic = rec0[exthOffset] === 0x45 // 'E'
        && rec0[exthOffset + 1] === 0x58 // 'X'
        && rec0[exthOffset + 2] === 0x54 // 'T'
        && rec0[exthOffset + 3] === 0x48 // 'H'

      if (isExthMagic) {
        const exthCount = rec0View.getUint32(exthOffset + 8, false)
        let pos = exthOffset + 12

        for (let i = 0; i < exthCount && pos + 8 <= rec0.byteLength; i++) {
          const recordType = rec0View.getUint32(pos, false)
          const recordLen = rec0View.getUint32(pos + 4, false)

          if (recordLen < 8 || pos + recordLen > rec0.byteLength)
            break

          const valueBytes = rec0.subarray(pos + 8, pos + recordLen)
          const valueStr = decodeCleanString(valueBytes, charset)

          if (valueStr) {
            if (recordType === 100) {
              exthAuthors.push(valueStr)
            }
            else if (recordType === 503 && !exthTitle) {
              exthTitle = valueStr
            }
            else if (recordType === 524 && !exthLanguage) {
              exthLanguage = valueStr
            }
          }

          pos += recordLen
        }
      }
    }
  }

  const maxTextRecord = Math.min(textRecordCount, numRecords - 1)
  const decompressedChunks: Uint8Array[] = []
  let totalDecompressedBytes = 0

  for (let recIdx = 1; recIdx <= maxTextRecord; recIdx++) {
    let rawRecord = getRecord(recIdx)

    if (extraDataFlags > 0) {
      rawRecord = trimTrailingRecordData(rawRecord, extraDataFlags)
    }

    const decompressed = compression === 2
      ? decompressPalmDocLz77(rawRecord)
      : rawRecord

    decompressedChunks.push(decompressed)
    totalDecompressedBytes += decompressed.byteLength
  }

  const combinedTextBytes = new Uint8Array(totalDecompressedBytes)
  let writeOffset = 0

  for (const chunk of decompressedChunks) {
    combinedTextBytes.set(chunk, writeOffset)
    writeOffset += chunk.byteLength
  }

  const decodedText = decodeTextBuffer(combinedTextBytes, charset)

  const normalizedHtml = decodedText
    .replace(/<mbp:pagebreak\s*\/?>/gi, '<hr/>')

  const $ = cheerio.load(normalizedHtml)
  $('script, style, head, title, meta').remove()

  const pageBuilder = new HtmlPageBuilder()
  const toc: TocItem[] = []
  let textSample = ''
  let pushedBlocksCount = 0

  const appendSample = (text: string) => {
    if (textSample.length < 6000 && text) {
      textSample += `${text} `
    }
  }

  const walkNode = (node: AnyNode): void => {
    if (node.type === 'text') {
      const text = (node.data || '').replace(/\s+/g, ' ').trim()

      if (text) {
        appendSample(text)
        pageBuilder.pushBlock(`<p>${escapeHtml(text)}</p>\n`, text.length)
        pushedBlocksCount++
      }

      return
    }

    if (!isElementNode(node))
      return

    const tag = node.tagName.toLowerCase()

    if (tag === 'script' || tag === 'style')
      return

    if (tag === 'hr') {
      pageBuilder.forcePageBreak()

      return
    }

    if (HEADING_TAGS.has(tag)) {
      const text = $(node).text().replace(/\s+/g, ' ').trim()

      if (text) {
        appendSample(text)
        const level = Number.parseInt(tag.slice(1), 10) || 1
        const order = toc.length
        const pageNum = pageBuilder.getPageNumForNextBlock(text.length)

        toc.push({
          id: `sec-${order}`,
          href: '',
          title: text,
          order,
          level,
          pageNum,
        })

        pageBuilder.pushBlock(`<${tag}>${escapeHtml(text)}</${tag}>\n`, text.length)
        pushedBlocksCount++
      }

      return
    }

    const children = $(node).contents().toArray()
    const hasBlockChild = children.some(child => isElementNode(child) && ALL_BLOCK_TAGS.has(child.tagName.toLowerCase()))

    if (hasBlockChild || CONTAINER_TAGS.has(tag)) {
      if (hasBlockChild) {
        for (const child of children) {
          walkNode(child)
        }

        return
      }
    }

    if (LEAF_BLOCK_TAGS.has(tag) || CONTAINER_TAGS.has(tag)) {
      const text = $(node).text().replace(/\s+/g, ' ').trim()

      if (text) {
        appendSample(text)
        const outTag = tag === 'blockquote' ? 'blockquote' : 'p'
        pageBuilder.pushBlock(`<${outTag}>${escapeHtml(text)}</${outTag}>\n`, text.length)
        pushedBlocksCount++
      }
    }
  }

  const bodyEl = $('body').get(0)

  if (bodyEl) {
    for (const child of $(bodyEl).contents().toArray()) {
      walkNode(child)
    }
  }

  if (pushedBlocksCount === 0 && decodedText.trim()) {
    const paragraphs = decodedText
      .replace(/<[^>]+>/g, '\n')
      .split(/\r?\n\s*\n/)
      .map(p => p.replace(/\s+/g, ' ').trim())
      .filter(Boolean)

    for (const para of paragraphs) {
      appendSample(para)
      pageBuilder.pushBlock(`<p>${escapeHtml(para)}</p>\n`, para.length)
    }
  }

  const pages = pageBuilder.finalize()
  const fallbackTitle = filename.replace(/\.(?:mobi|azw3?|prc)$/i, '')
  const title = exthTitle || mobiFullName || fallbackTitle
  const author = exthAuthors.length > 0 ? exthAuthors.join(', ') : null
  const language = detectLanguageFromText(textSample, exthLanguage)

  return {
    title,
    author,
    language,
    pages,
    toc,
  }
}

export async function processMobi(filePath: string, filename: string, userId: number): Promise<number> {
  try {
    const bytes = await Bun.file(filePath).bytes()
    const parsed = parseMobiBuffer(bytes, filename)

    return await insertParsedBookToDb({
      userId,
      type: 'mobi',
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
