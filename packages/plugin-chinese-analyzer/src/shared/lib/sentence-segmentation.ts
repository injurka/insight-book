import type { LexemeToken, SyllableTonePoint } from '../../modules/chinese-analyzer/model'

export interface SegmentedTokenItem {
  token: LexemeToken
  trailingPunctuation: string
}

export interface TokenSentenceGroup {
  sentenceIndex: number
  items: SegmentedTokenItem[]
}

export interface SyllableSentenceGroup {
  sentenceIndex: number
  syllables: SyllableTonePoint[]
  endPunctuation: string
}

const SENTENCE_END_PUNCT_RE = /[。！？!?；;\n]/
const TRAILING_PUNCT_CHAR_RE = /[，,、：:；;。！？!?.…—–\-~”’」』》）)]/

function readFollowingPunctuation(source: string, startIndex: number): { punct: string, nextCursor: number } {
  let idx = startIndex
  let punct = ''

  while (idx < source.length) {
    const ch = source[idx]

    if (TRAILING_PUNCT_CHAR_RE.test(ch) || ch === '\n') {
      punct += ch
      idx++
    }
    else if (ch === ' ' || ch === '\t') {
      idx++
    }
    else {
      break
    }
  }

  return { punct: punct.trim(), nextCursor: idx }
}

function hasExplicitSentenceIndices(tokens: LexemeToken[]): boolean {
  const indices = new Set(tokens
    .map(t => t.sentenceIndex)
    .filter((idx): idx is number => typeof idx === 'number' && Number.isFinite(idx)))

  return indices.size > 1
}

function groupByExplicitIndices(tokens: LexemeToken[]): TokenSentenceGroup[] {
  const groups = new Map<number, SegmentedTokenItem[]>()

  for (const token of tokens) {
    const sIdx = typeof token.sentenceIndex === 'number' ? token.sentenceIndex : 0
    const list = groups.get(sIdx) ?? []
    list.push({
      token,
      trailingPunctuation: token.trailingPunctuation ?? '',
    })
    groups.set(sIdx, list)
  }

  return Array.from(groups.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([sentenceIndex, items]) => ({ sentenceIndex, items }))
}

function advanceCursorToToken(source: string, cursor: number, tokenHanzi: string): number {
  if (!tokenHanzi) {
    return cursor
  }

  const found = source.indexOf(tokenHanzi, cursor)

  if (found !== -1) {
    return found + tokenHanzi.length
  }

  return cursor
}

export function groupTokensBySentence(hanzi: string, tokens: LexemeToken[]): TokenSentenceGroup[] {
  if (tokens.length === 0) {
    return []
  }

  if (hasExplicitSentenceIndices(tokens)) {
    return groupByExplicitIndices(tokens)
  }

  const groups: TokenSentenceGroup[] = []
  let currentItems: SegmentedTokenItem[] = []
  let sentenceIndex = 0
  let cursor = 0

  for (const token of tokens) {
    const explicitPunct = token.trailingPunctuation?.trim() ?? ''
    cursor = advanceCursorToToken(hanzi, cursor, token.hanzi)
    const scanned = readFollowingPunctuation(hanzi, cursor)
    cursor = scanned.nextCursor

    const trailingPunctuation = explicitPunct || scanned.punct
    currentItems.push({ token, trailingPunctuation })

    if (SENTENCE_END_PUNCT_RE.test(trailingPunctuation)) {
      groups.push({ sentenceIndex, items: currentItems })
      currentItems = []
      sentenceIndex++
    }
  }

  if (currentItems.length > 0) {
    groups.push({ sentenceIndex, items: currentItems })
  }

  return groups
}

export function splitTextIntoSentenceLines(text: string): string[] {
  const clean = text.trim()

  if (!clean) {
    return []
  }

  if (clean.includes('\n')) {
    return clean.split(/\n+/).map(line => line.trim()).filter(Boolean)
  }

  return clean
    .split(/(?<=[.!?。！？…])\s+/)
    .map(line => line.replace(/^\/\s*/, '').trim())
    .filter(Boolean)
}

function isTopLevelFormulaBreak(formula: string, index: number, depth: number): number {
  if (depth !== 0) {
    return 0
  }

  const ch = formula[index]

  if (ch === '\n' || ch === ';' || ch === '；' || ch === '|') {
    return 1
  }

  if (formula.slice(index, index + 3) === ' / ') {
    return 3
  }

  return 0
}

function updateBracketDepth(ch: string, depth: number): number {
  if (ch === '[' || ch === '(' || ch === '（') {
    return depth + 1
  }

  if (ch === ']' || ch === ')' || ch === '）') {
    return Math.max(0, depth - 1)
  }

  return depth
}

export function splitFormulaIntoLines(formula: string): string[] {
  const clean = formula.trim()

  if (!clean) {
    return []
  }

  const parts: string[] = []
  let buffer = ''
  let depth = 0

  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i]
    const breakLen = isTopLevelFormulaBreak(clean, i, depth)

    if (breakLen > 0) {
      if (buffer.trim()) {
        parts.push(buffer.trim())
      }

      buffer = ''
      i += breakLen - 1
      continue
    }

    depth = updateBracketDepth(ch, depth)
    buffer += ch
  }

  if (buffer.trim()) {
    parts.push(buffer.trim())
  }

  return parts.length > 0 ? parts : [clean]
}

export function splitRhythmIntoSentenceRows(rhythmGrouping: string): string[][] {
  const clean = rhythmGrouping.trim()

  if (!clean) {
    return []
  }

  const rawLines = clean.includes('\n')
    ? clean.split(/\n+/)
    : clean.split(/(?<=[。！？!?；;])\s*(?:\/\s*)?/)

  return rawLines
    .map(line => line.split('/').map(seg => seg.trim()).filter(Boolean))
    .filter(segments => segments.length > 0)
}

export function groupSyllablesBySentence(hanzi: string, syllables: SyllableTonePoint[]): SyllableSentenceGroup[] {
  if (syllables.length === 0) {
    return []
  }

  const groups: SyllableSentenceGroup[] = []
  let current: SyllableTonePoint[] = []
  let sentenceIndex = 0
  let cursor = 0

  for (const syl of syllables) {
    cursor = advanceCursorToToken(hanzi, cursor, syl.hanzi)
    const scanned = readFollowingPunctuation(hanzi, cursor)
    cursor = scanned.nextCursor
    current.push(syl)

    if (SENTENCE_END_PUNCT_RE.test(scanned.punct)) {
      groups.push({
        sentenceIndex,
        syllables: current,
        endPunctuation: scanned.punct,
      })
      current = []
      sentenceIndex++
    }
  }

  if (current.length > 0) {
    groups.push({
      sentenceIndex,
      syllables: current,
      endPunctuation: '',
    })
  }

  return groups
}
