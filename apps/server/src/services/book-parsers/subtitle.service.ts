import type { TocItem } from '../../types'
import { unlink } from 'node:fs/promises'
import {
  decodeTextBuffer,
  detectLanguageFromText,
  escapeHtml,
  HtmlPageBuilder,
  insertParsedBookToDb,
} from './book-parser.utils'

export interface ParsedSubtitleBook {
  title: string
  author: string | null
  language: string
  pages: string[]
  toc: TocItem[]
}

export interface SubtitleCue {
  startMs: number
  endMs: number
  speaker?: string
  text: string
}

type SubtitleFormat = 'srt' | 'vtt' | 'ass'

const TIME_SECTION_INTERVAL_MS = 600_000 // 10 minutes

const IGNORED_TITLES = new Set([
  'default aegisub file',
  'untitled',
  '<untitled>',
  'original script',
])

const IGNORED_SPEAKERS = new Set([
  'default',
  'ntp',
  'none',
  'comment',
  'main',
])

function parseTimestampToMs(raw: string): number | null {
  const trimmed = raw.trim()
  // Supports HH:MM:SS,mmm | HH:MM:SS.mmm | H:MM:SS.cc | MM:SS.mmm | MM:SS,mmm
  const match = trimmed.match(/^(?:(\d{1,3}):)?(\d{1,2}):(\d{2})[,.](\d{1,3})$/)

  if (!match)
    return null

  const hours = match[1] ? Number.parseInt(match[1], 10) : 0
  const minutes = Number.parseInt(match[2], 10)
  const seconds = Number.parseInt(match[3], 10)
  const fracStr = match[4].padEnd(3, '0')
  const millis = Number.parseInt(fracStr, 10)

  return ((hours * 3600 + minutes * 60 + seconds) * 1000) + millis
}

function formatMsToLabel(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  const mm = String(minutes).padStart(2, '0')
  const ss = String(seconds).padStart(2, '0')

  if (hours > 0) {
    const hh = String(hours).padStart(2, '0')

    return `${hh}:${mm}:${ss}`
  }

  return `${mm}:${ss}`
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, '\'')
    .replace(/&#(\d+);/g, (_, dec: string) => {
      const code = Number.parseInt(dec, 10)

      return Number.isNaN(code) ? '' : String.fromCodePoint(code)
    })
}

function isPureNoiseOrMusic(text: string): boolean {
  const stripped = text
    .replace(/[♪♫♬♩♭♮♯~\s\-–—.,!?()[\]]+/g, '')
    .replace(/^(?:music|музыка|applause|аплодисменты|laughter|смех|silence|тишина)$/i, '')
    .trim()

  return stripped.length === 0
}

function cleanCueLine(line: string): string {
  return decodeHtmlEntities(line
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')).trim()
}

function cleanCueText(rawText: string): string {
  const lines = rawText
    .split(/\r?\n/)
    .map(cleanCueLine)
    .filter(l => l.length > 0 && !isPureNoiseOrMusic(l))

  const joined = lines.join(' ').replace(/\s+/g, ' ').trim()

  if (!joined || isPureNoiseOrMusic(joined))
    return ''

  return joined
}

function normalizeForDedup(text: string): string {
  return text.toLowerCase().replace(/\s+/g, ' ').trim()
}

function deduplicateCues(cues: SubtitleCue[]): SubtitleCue[] {
  const result: SubtitleCue[] = []
  let prevLines: string[] = []
  let prevNormalized = ''

  for (const cue of cues) {
    const rawLines = cue.text
      .split(/\r?\n/)
      .map(cleanCueLine)
      .filter(l => l.length > 0 && !isPureNoiseOrMusic(l))

    if (rawLines.length === 0)
      continue

    // Handle YouTube / roll-up VTT where multi-line cues repeat trailing lines from the previous cue
    let filteredLines = rawLines

    if (prevLines.length > 0 && rawLines.length > 1) {
      const prevLastNorm = normalizeForDedup(prevLines[prevLines.length - 1])
      const currFirstNorm = normalizeForDedup(rawLines[0])

      if (currFirstNorm === prevLastNorm) {
        filteredLines = rawLines.slice(1)
      }
    }

    prevLines = rawLines

    const cleanedText = filteredLines.join(' ').replace(/\s+/g, ' ').trim()

    if (!cleanedText || isPureNoiseOrMusic(cleanedText))
      continue

    const normalized = normalizeForDedup(cleanedText)

    if (normalized === prevNormalized)
      continue

    prevNormalized = normalized
    result.push({
      startMs: cue.startMs,
      endMs: cue.endMs,
      speaker: cue.speaker,
      text: cleanedText,
    })
  }

  return result
}

function detectSubtitleFormat(content: string, filename: string): SubtitleFormat {
  const lowerName = filename.toLowerCase()
  const trimmedStart = content.trimStart()

  if (trimmedStart.startsWith('WEBVTT') || lowerName.endsWith('.vtt')) {
    return 'vtt'
  }

  if (
    lowerName.endsWith('.ass')
    || lowerName.endsWith('.ssa')
    || /^\[Script Info\]/im.test(trimmedStart)
    || /^\[Events\]/im.test(trimmedStart)
  ) {
    return 'ass'
  }

  return 'srt'
}

function extractSpeakerAndStripVttTags(rawCueBody: string): { speaker?: string, text: string } {
  let body = rawCueBody.trim()
  let speaker: string | undefined

  if (/^<v[\s.]/i.test(body)) {
    const closeIdx = body.indexOf('>')

    if (closeIdx !== -1) {
      const tagAttr = body.slice(2, closeIdx)
      const spaceIdx = tagAttr.search(/\s/)

      if (spaceIdx !== -1) {
        const candidate = tagAttr.slice(spaceIdx + 1).trim()

        if (candidate && !IGNORED_SPEAKERS.has(candidate.toLowerCase())) {
          speaker = candidate
        }
      }

      body = body.slice(closeIdx + 1).replace(/<\/v>/gi, '')
    }
  }

  // Strip VTT inline timestamp tags <00:01.000>, class tags <c.color>, etc.
  const withoutTags = body.replace(/<[^>]+>/g, '')

  return { speaker, text: withoutTags }
}

function parseSrtOrVtt(content: string, isVtt: boolean): { title?: string, metaLang?: string, cues: SubtitleCue[] } {
  const normalized = content.replace(/\r\n?/g, '\n')
  const blocks = normalized.split(/\n{2,}/)
  const cues: SubtitleCue[] = []
  let title: string | undefined
  let metaLang: string | undefined

  const arrowRegex = /^((?:\d{1,3}:)?\d{1,2}:\d{2}[,.]\d{1,3})\s*-->\s*((?:\d{1,3}:)?\d{1,2}:\d{2}[,.]\d{1,3})(?:\s.*)?$/

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i].trim()

    if (!block)
      continue

    const lines = block.split('\n').map(l => l.trim())

    if (isVtt && i === 0 && lines[0].startsWith('WEBVTT')) {
      const headerInlineTitle = lines[0].replace(/^WEBVTT\s*(?:-\s*)?/, '').trim()

      if (headerInlineTitle && !headerInlineTitle.includes(':')) {
        title = headerInlineTitle
      }

      for (let h = 1; h < lines.length; h++) {
        const colonIdx = lines[h].indexOf(':')

        if (colonIdx > 0) {
          const key = lines[h].slice(0, colonIdx).trim().toLowerCase()
          const val = lines[h].slice(colonIdx + 1).trim()

          if (key === 'title' && val && !IGNORED_TITLES.has(val.toLowerCase())) {
            title = val
          }
          else if ((key === 'language' || key === 'lang') && val) {
            metaLang = val
          }
        }
      }

      continue
    }

    if (isVtt && /^(?:NOTE|STYLE|REGION)(?:\s|$)/i.test(lines[0])) {
      continue
    }

    // Find the line containing `-->`
    let arrowLineIdx = -1
    let startMs: number | null = null
    let endMs: number | null = null

    for (let lIdx = 0; lIdx < lines.length; lIdx++) {
      const match = lines[lIdx].match(arrowRegex)

      if (match) {
        startMs = parseTimestampToMs(match[1])
        endMs = parseTimestampToMs(match[2])
        arrowLineIdx = lIdx
        break
      }
    }

    if (arrowLineIdx === -1 || startMs === null || endMs === null)
      continue

    const payloadLines = lines.slice(arrowLineIdx + 1)

    if (payloadLines.length === 0)
      continue

    const rawBody = payloadLines.join('\n')
    const { speaker, text } = extractSpeakerAndStripVttTags(rawBody)

    if (!text.trim())
      continue

    cues.push({
      startMs,
      endMs,
      speaker,
      text,
    })
  }

  return { title, metaLang, cues }
}

function parseAssOrSsa(content: string): { title?: string, cues: SubtitleCue[] } {
  const lines = content.replace(/\r\n?/g, '\n').split('\n')
  let currentSection = ''
  let title: string | undefined

  let startIdx = 1
  let endIdx = 2
  let nameIdx = 4
  let textIdx = 9
  let totalFields = 10

  const cues: SubtitleCue[] = []

  for (const rawLine of lines) {
    const line = rawLine.trim()

    if (!line || line.startsWith(';'))
      continue

    const sectionMatch = line.match(/^\[([^\]]+)\]$/)

    if (sectionMatch) {
      currentSection = sectionMatch[1].trim().toLowerCase()
      continue
    }

    if (currentSection === 'script info') {
      if (/^Title\s*:/i.test(line)) {
        const candidate = line.slice(line.indexOf(':') + 1).trim()

        if (candidate && !IGNORED_TITLES.has(candidate.toLowerCase())) {
          title = candidate
        }
      }
    }
    else if (currentSection === 'events') {
      if (/^Format\s*:/i.test(line)) {
        const formatBody = line.replace(/^Format\s*:\s*/i, '')
        const cols = formatBody.split(',').map(c => c.trim().toLowerCase())

        if (cols.length >= 3) {
          totalFields = cols.length
          const sIdx = cols.indexOf('start')
          const eIdx = cols.indexOf('end')
          const nIdx = cols.includes('name') ? cols.indexOf('name') : cols.indexOf('actor')
          const tIdx = cols.indexOf('text')

          if (sIdx !== -1)
            startIdx = sIdx

          if (eIdx !== -1)
            endIdx = eIdx

          if (nIdx !== -1)
            nameIdx = nIdx

          if (tIdx !== -1)
            textIdx = tIdx
        }
      }
      else if (/^Dialogue\s*:/i.test(line)) {
        const dialogueBody = line.replace(/^Dialogue\s*:\s*/i, '')
        const parts: string[] = []
        let cursor = 0

        for (let f = 0; f < totalFields - 1; f++) {
          const commaPos = dialogueBody.indexOf(',', cursor)

          if (commaPos === -1)
            break

          parts.push(dialogueBody.slice(cursor, commaPos).trim())
          cursor = commaPos + 1
        }

        parts.push(dialogueBody.slice(cursor))

        if (parts.length <= textIdx)
          continue

        const startMs = parseTimestampToMs(parts[startIdx] || '')
        const endMs = parseTimestampToMs(parts[endIdx] || '')

        if (startMs === null || endMs === null)
          continue

        const rawText = parts[textIdx] || ''

        // Skip ASS vector drawing commands like {\p1}...
        if (/\{[^}]*\\p[1-9]\b[^}]*\}/.test(rawText))
          continue

        const strippedAss = rawText
          .replace(/\{[^}]*\}/g, '')
          .replace(/\\N/gi, '\n')
          .replace(/\\h/g, ' ')

        const cleaned = cleanCueText(strippedAss)

        if (!cleaned)
          continue

        const rawSpeaker = nameIdx >= 0 && nameIdx < parts.length ? parts[nameIdx].trim() : ''
        const speaker = rawSpeaker && !IGNORED_SPEAKERS.has(rawSpeaker.toLowerCase())
          ? rawSpeaker
          : undefined

        cues.push({
          startMs,
          endMs,
          speaker,
          text: cleaned,
        })
      }
    }
  }

  return { title, cues }
}

export function parseSubtitleBuffer(bytes: Uint8Array, filename: string): ParsedSubtitleBook {
  const content = decodeTextBuffer(bytes)
  const format = detectSubtitleFormat(content, filename)

  let extractedTitle: string | undefined
  let metaLang: string | undefined
  let rawCues: SubtitleCue[] = []

  if (format === 'ass') {
    const parsedAss = parseAssOrSsa(content)
    extractedTitle = parsedAss.title
    rawCues = parsedAss.cues
  }
  else {
    const parsedSrtVtt = parseSrtOrVtt(content, format === 'vtt')
    extractedTitle = parsedSrtVtt.title
    metaLang = parsedSrtVtt.metaLang
    rawCues = parsedSrtVtt.cues
  }

  const cues = deduplicateCues(rawCues)
  const fallbackTitle = filename.replace(/\.(?:srt|vtt|ass|ssa)$/i, '') || 'Subtitles'
  const title = extractedTitle || fallbackTitle

  const pageBuilder = new HtmlPageBuilder()
  const toc: TocItem[] = []
  let tocOrder = 0
  let textSample = ''

  const maxTimeMs = cues.length > 0
    ? Math.max(...cues.map(c => Math.max(c.startMs, c.endMs)))
    : 0
  const useTimeSections = maxTimeMs >= TIME_SECTION_INTERVAL_MS
  let currentBucket = -1

  for (const cue of cues) {
    if (useTimeSections) {
      const bucket = Math.floor(cue.startMs / TIME_SECTION_INTERVAL_MS)

      if (bucket > currentBucket) {
        currentBucket = bucket
        const sectionStartMs = bucket * TIME_SECTION_INTERVAL_MS
        const sectionEndMs = (bucket + 1) * TIME_SECTION_INTERVAL_MS
        const sectionTitle = `${formatMsToLabel(sectionStartMs)} — ${formatMsToLabel(sectionEndMs)}`
        const headingHtml = `<h2>${escapeHtml(sectionTitle)}</h2>\n`
        const pageNum = pageBuilder.getPageNumForNextBlock(sectionTitle.length)
        const order = tocOrder++

        toc.push({
          id: `sec-${order}`,
          href: '',
          title: sectionTitle,
          order,
          level: 1,
          pageNum,
        })

        pageBuilder.pushBlock(headingHtml, sectionTitle.length)
      }
    }

    if (textSample.length < 6000) {
      textSample += `${cue.text} `
    }

    const speakerPrefix = cue.speaker
      ? `<strong>${escapeHtml(cue.speaker)}:</strong> `
      : ''
    const visibleLength = (cue.speaker ? `${cue.speaker}: ` : '').length + cue.text.length
    const cueHtml = `<p>${speakerPrefix}${escapeHtml(cue.text)}</p>\n`

    pageBuilder.pushBlock(cueHtml, visibleLength)
  }

  const pages = pageBuilder.finalize()
  const language = detectLanguageFromText(textSample, metaLang)

  return {
    title,
    author: null,
    language,
    pages,
    toc,
  }
}

export async function processSubtitle(filePath: string, filename: string, userId: number): Promise<number> {
  try {
    const bytes = await Bun.file(filePath).bytes()
    const parsed = parseSubtitleBuffer(bytes, filename)

    return await insertParsedBookToDb({
      userId,
      type: 'srt',
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
