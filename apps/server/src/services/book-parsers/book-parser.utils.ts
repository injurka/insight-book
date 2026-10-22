import type { TocItem } from '../../types'
import { normalizeLanguageCode } from '~/utils/helpers'
import { PAGE_SIZE_CHARS } from '../../config'
import { db } from '../../db'
import * as schema from '../../db/schema'

// Таблица символов Windows-1251 для байтов 0x80..0xFF
const CP1251_HIGH_BYTES = [
  0x0402,
  0x0403,
  0x201A,
  0x0453,
  0x201E,
  0x2026,
  0x2020,
  0x2021,
  0x20AC,
  0x2030,
  0x0409,
  0x2039,
  0x040A,
  0x040C,
  0x040B,
  0x040F,
  0x0452,
  0x2018,
  0x2019,
  0x201C,
  0x201D,
  0x2022,
  0x2013,
  0x2014,
  0xFFFD,
  0x2122,
  0x0459,
  0x203A,
  0x045A,
  0x045C,
  0x045B,
  0x045F,
  0x00A0,
  0x040E,
  0x045E,
  0x0408,
  0x00A4,
  0x0490,
  0x00A6,
  0x00A7,
  0x0401,
  0x00A9,
  0x0404,
  0x00AB,
  0x00AC,
  0x00AD,
  0x00AE,
  0x0407,
  0x00B0,
  0x00B1,
  0x0406,
  0x0456,
  0x0491,
  0x00B5,
  0x00B6,
  0x00B7,
  0x0451,
  0x2116,
  0x0454,
  0x00BB,
  0x0458,
  0x0405,
  0x0455,
  0x0457,
  0x0410,
  0x0411,
  0x0412,
  0x0413,
  0x0414,
  0x0415,
  0x0416,
  0x0417,
  0x0418,
  0x0419,
  0x041A,
  0x041B,
  0x041C,
  0x041D,
  0x041E,
  0x041F,
  0x0420,
  0x0421,
  0x0422,
  0x0423,
  0x0424,
  0x0425,
  0x0426,
  0x0427,
  0x0428,
  0x0429,
  0x042A,
  0x042B,
  0x042C,
  0x042D,
  0x042E,
  0x042F,
  0x0430,
  0x0431,
  0x0432,
  0x0433,
  0x0434,
  0x0435,
  0x0436,
  0x0437,
  0x0438,
  0x0439,
  0x043A,
  0x043B,
  0x043C,
  0x043D,
  0x043E,
  0x043F,
  0x0440,
  0x0441,
  0x0442,
  0x0443,
  0x0444,
  0x0445,
  0x0446,
  0x0447,
  0x0448,
  0x0449,
  0x044A,
  0x044B,
  0x044C,
  0x044D,
  0x044E,
  0x044F,
]

export function decodeWindows1251(bytes: Uint8Array): string {
  const chunkSize = 16384
  let result = ''

  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const end = Math.min(offset + chunkSize, bytes.length)
    const codes: number[] = []

    for (let i = offset; i < end; i++) {
      const b = bytes[i]
      codes.push(b < 0x80 ? b : CP1251_HIGH_BYTES[b - 0x80])
    }

    result += String.fromCharCode(...codes)
  }

  return result
}

function scoreDecodedText(text: string): number {
  const sample = text.slice(0, 8000)

  if (!sample)
    return 0

  let replacementCount = 0
  let usefulChars = 0

  for (let i = 0; i < sample.length; i++) {
    const code = sample.charCodeAt(i)

    if (code === 0xFFFD) {
      replacementCount++
    }
    else if (
      (code >= 0x4E00 && code <= 0x9FFF) // CJK Unified Ideographs
      || (code >= 0x3040 && code <= 0x30FF) // Hiragana + Katakana
      || (code >= 0xAC00 && code <= 0xD7AF) // Hangul Syllables
      || (code >= 0x0410 && code <= 0x044F) // Cyrillic
      || (code >= 0x0041 && code <= 0x007A) // Basic Latin
      || (code >= 0x3000 && code <= 0x303F) // CJK punctuation
    ) {
      usefulChars++
    }
  }

  return (usefulChars - replacementCount * 10) / sample.length
}

function isLikelyWindows1251(bytes: Uint8Array): boolean {
  const limit = Math.min(bytes.length, 8192)
  let highBytes = 0
  let cyrillicLetterBytes = 0
  let cyrillicLowerBytes = 0

  for (let i = 0; i < limit; i++) {
    const b = bytes[i]

    if (b >= 0x80) {
      highBytes++

      if ((b >= 0xC0 && b <= 0xFF) || b === 0xA8 || b === 0xB8) {
        cyrillicLetterBytes++

        if ((b >= 0xE0 && b <= 0xFF) || b === 0xB8) {
          cyrillicLowerBytes++
        }
      }
    }
  }

  if (highBytes < 4)
    return false

  return cyrillicLetterBytes / highBytes >= 0.85 && cyrillicLowerBytes / cyrillicLetterBytes >= 0.65
}

/**
 * Автоматически определяет кодировку буфера (UTF-8, UTF-16LE/BE, GB18030/GBK, Big5, Shift_JIS, EUC-KR, Windows-1251)
 * и возвращает декодированную строку без BOM.
 */
export function decodeTextBuffer(bytes: Uint8Array, explicitCharset?: string): string {
  if (bytes.length === 0)
    return ''

  // 1. Проверка BOM
  if (bytes.length >= 3 && bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF) {
    return new TextDecoder('utf-8').decode(bytes.subarray(3))
  }

  if (bytes.length >= 2 && bytes[0] === 0xFF && bytes[1] === 0xFE) {
    return new TextDecoder('utf-16le').decode(bytes.subarray(2))
  }

  if (bytes.length >= 2 && bytes[0] === 0xFE && bytes[1] === 0xFF) {
    return new TextDecoder('utf-16be').decode(bytes.subarray(2))
  }

  // 2. Явно переданная кодировка (например, из <meta charset="...">)
  if (explicitCharset) {
    const normalized = explicitCharset.trim().toLowerCase()

    if (normalized === 'windows-1251' || normalized === 'cp1251' || normalized === 'win1251') {
      return decodeWindows1251(bytes)
    }

    try {
      return new TextDecoder(normalized).decode(bytes)
    }
    catch {
      // Fallback к автодетекту
    }
  }

  // 3. Проверка на UTF-16 без BOM (чередование нулевых байтов)
  if (bytes.length >= 16) {
    const sampleLen = Math.min(bytes.length, 512)
    let evenZeros = 0
    let oddZeros = 0
    const pairs = Math.floor(sampleLen / 2)

    for (let i = 0; i < pairs * 2; i += 2) {
      if (bytes[i] === 0)
        evenZeros++

      if (bytes[i + 1] === 0)
        oddZeros++
    }

    if (oddZeros / pairs > 0.4 && evenZeros / pairs < 0.05) {
      return new TextDecoder('utf-16le').decode(bytes)
    }

    if (evenZeros / pairs > 0.4 && oddZeros / pairs < 0.05) {
      return new TextDecoder('utf-16be').decode(bytes)
    }
  }

  // 4. Строгая проверка UTF-8
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  }
  catch {
    // Не валидный UTF-8 — переходим к эвристикам
  }

  // 5. Проверка на Windows-1251 (кириллица)
  if (isLikelyWindows1251(bytes)) {
    return decodeWindows1251(bytes)
  }

  // 6. Перебор популярных CJK кодировок и Windows-1251 по качеству символов
  const candidates: Array<{ text: string, score: number }> = []

  for (const enc of ['gb18030', 'big5', 'shift_jis', 'euc-kr']) {
    try {
      const decoded = new TextDecoder(enc, { fatal: true }).decode(bytes)
      candidates.push({ text: decoded, score: scoreDecodedText(decoded) + 0.1 })
    }
    catch {
      try {
        const decoded = new TextDecoder(enc).decode(bytes)
        candidates.push({ text: decoded, score: scoreDecodedText(decoded) })
      }
      catch {}
    }
  }

  const cp1251Text = decodeWindows1251(bytes)
  candidates.push({ text: cp1251Text, score: scoreDecodedText(cp1251Text) })

  candidates.sort((a, b) => b.score - a.score)

  if (candidates.length > 0 && candidates[0].score > 0.2) {
    return candidates[0].text
  }

  return new TextDecoder('utf-8').decode(bytes)
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Автоматически определяет язык текста по распределению письменностей (zh, ja, ko, ru/uk/be/bg, en)
 * и метаданным.
 */
export function detectLanguageFromText(textSample: string, metaLang?: string): string {
  const sample = textSample.slice(0, 6000)
  const cyrillicCount = (sample.match(/\p{Script=Cyrillic}/gu) || []).length
  const hanCount = (sample.match(/\p{Script=Han}/gu) || []).length
  const kanaCount = (sample.match(/[\p{Script=Hiragana}\p{Script=Katakana}]/gu) || []).length
  const hangulCount = (sample.match(/\p{Script=Hangul}/gu) || []).length
  const latinCount = (sample.match(/\p{Script=Latin}/gu) || []).length

  const totalLetters = cyrillicCount + hanCount + kanaCount + hangulCount + latinCount

  if (totalLetters > 10) {
    if (kanaCount > 3 && (kanaCount + hanCount) / totalLetters > 0.25)
      return 'ja'

    if (hanCount / totalLetters > 0.25)
      return 'zh'

    if (hangulCount / totalLetters > 0.25)
      return 'ko'

    if (cyrillicCount / totalLetters > 0.3) {
      if (metaLang) {
        const normalizedMeta = normalizeLanguageCode(metaLang)

        if (['ru', 'uk', 'be', 'bg'].includes(normalizedMeta))
          return normalizedMeta
      }

      return 'ru'
    }
  }

  if (metaLang) {
    const normalized = normalizeLanguageCode(metaLang)

    if (normalized)
      return normalized
  }

  if (hanCount > cyrillicCount && hanCount > latinCount)
    return 'zh'

  return cyrillicCount > latinCount ? 'ru' : 'en'
}

/**
 * Помощник для разбивки HTML-блоков на страницы по PAGE_SIZE_CHARS
 * и точного вычисления номера страницы для оглавления (TOC).
 */
export class HtmlPageBuilder {
  private pages: string[] = []
  private currentPageHtml = ''
  private currentLen = 0
  private readonly pageSizeChars: number

  constructor(pageSizeChars = PAGE_SIZE_CHARS) {
    this.pageSizeChars = pageSizeChars
  }

  getPageNumForNextBlock(textLen: number): number {
    if (this.currentLen > 0 && this.currentLen + textLen >= this.pageSizeChars) {
      return this.pages.length + 2
    }

    return this.pages.length + 1
  }

  pushBlock(blockHtml: string, textLen: number): void {
    if (!blockHtml)
      return

    if (this.currentLen > 0 && this.currentLen + textLen >= this.pageSizeChars) {
      this.pages.push(this.currentPageHtml)
      this.currentPageHtml = ''
      this.currentLen = 0
    }

    this.currentPageHtml += blockHtml
    this.currentLen += textLen
  }

  forcePageBreak(): void {
    if (this.currentPageHtml.trim()) {
      this.pages.push(this.currentPageHtml)
      this.currentPageHtml = ''
      this.currentLen = 0
    }
  }

  finalize(fallbackMessage = 'Текст книги не найден или формат не поддерживается.'): string[] {
    if (this.currentPageHtml.trim()) {
      this.pages.push(this.currentPageHtml)
      this.currentPageHtml = ''
      this.currentLen = 0
    }

    if (this.pages.length === 0) {
      return [`<p>${escapeHtml(fallbackMessage)}</p>`]
    }

    return this.pages
  }
}

export interface InsertParsedBookInput {
  userId: number
  type: string
  title: string
  author: string | null
  coverUrl?: string | null
  filePath: string
  language: string
  pages: string[]
  toc: TocItem[]
}

export async function insertParsedBookToDb(input: InsertParsedBookInput): Promise<number> {
  return await db.transaction(async (tx) => {
    const [insertedBook] = await tx.insert(schema.books).values({
      userId: input.userId,
      type: input.type,
      title: input.title,
      author: input.author,
      coverUrl: input.coverUrl ?? null,
      filePath: input.filePath,
      language: input.language,
      totalPages: input.pages.length,
      toc: JSON.stringify(input.toc),
    }).returning({ id: schema.books.id })

    const bId = insertedBook.id

    const pagesToInsert = input.pages.map((content, idx) => ({
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
      userId: input.userId,
      currentPage: 1,
    }).onConflictDoNothing()

    return bId
  })
}
