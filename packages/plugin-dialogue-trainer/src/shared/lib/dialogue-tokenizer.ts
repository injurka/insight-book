import { requestNlpTokenize } from './api'

export interface TokenItem {
  word: string
  pos: string
  tokenIdx: number
  isPunct: boolean
  spacingClass: string
}

export interface TokenizedSentence {
  sentId: number
  index: number
  rawSent: string
  tokens: TokenItem[]
}

function normalizeLanguageCode(code?: string | null): string {
  if (!code)
    return 'en'

  return code.toLowerCase().split(/[-,;]/)[0].trim()
}

const SEMICOLON_BOUNDARY = /[;；]+\s*/gu

function splitAtSemicolons(text: string): string[] {
  const segments: string[] = []
  let start = 0

  for (const match of text.matchAll(SEMICOLON_BOUNDARY)) {
    const end = (match.index ?? 0) + match[0].length
    segments.push(text.slice(start, end))
    start = end
  }

  if (start < text.length)
    segments.push(text.slice(start))

  return segments
}

export function splitTextIntoSentences(text: string, language: string): string[] {
  if (!text || !text.trim())
    return []

  const lang = normalizeLanguageCode(language)

  try {
    const segmenter = new Intl.Segmenter(lang, { granularity: 'sentence' })
    const sentences = Array.from(segmenter.segment(text), ({ segment }) => segment)
      .flatMap(splitAtSemicolons)

    return sentences.map(s => s.trim()).filter(s => s.length > 0)
  }
  catch {
    return (text.match(/[^.。！？…!?;；\n]*(?:[.。！？…!?;；]+[^\S\n]*|\n+|$)/gu) || [])
      .map(s => s.trim())
      .filter(s => s.length > 0)
  }
}

function tokenizeWithFallback(sentenceText: string, isCjk: boolean): TokenItem[] {
  const tokens: TokenItem[] = []
  const parts = sentenceText.split(/(\s+|[^\p{L}\p{N}\s]+)/u).filter(Boolean)
  let wordIdx = 0

  for (const part of parts) {
    if (/^\s+$/.test(part)) {
      if (tokens.length > 0 && !isCjk) {
        tokens[tokens.length - 1].spacingClass = 'add-space'
      }

      continue
    }

    const isWord = /[\p{L}\p{N}]/u.test(part)
    tokens.push({
      word: part,
      pos: isWord ? 'word' : 'x',
      tokenIdx: isWord ? wordIdx++ : 0,
      isPunct: !isWord,
      spacingClass: '',
    })
  }

  return tokens
}

export function tokenizeSentenceWords(sentenceText: string, language: string, _sentId?: number): TokenItem[] {
  const lang = normalizeLanguageCode(language)
  const isCjk = ['zh', 'ja'].includes(lang)

  try {
    const segmenter = new Intl.Segmenter(lang, { granularity: 'word' })
    const tokens: TokenItem[] = []
    let wordIdx = 0

    for (const { segment, isWordLike } of segmenter.segment(sentenceText)) {
      if (/^\s+$/.test(segment)) {
        if (tokens.length > 0 && !isCjk) {
          tokens[tokens.length - 1].spacingClass = 'add-space'
        }

        continue
      }

      const isWord = Boolean(isWordLike) && /[\p{L}\p{N}]/u.test(segment)
      const isPunct = !isWord
      const pos = isWord ? 'word' : 'x'

      tokens.push({
        word: segment,
        pos,
        tokenIdx: isWord ? wordIdx++ : 0,
        isPunct,
        spacingClass: '',
      })
    }

    return tokens
  }
  catch {
    return tokenizeWithFallback(sentenceText, isCjk)
  }
}

export function tokenizeDialogueText(text: string, language: string, baseSentId = 0): TokenizedSentence[] {
  const sentenceStrings = splitTextIntoSentences(text, language)

  return sentenceStrings.map((rawSent, index) => {
    const sentId = baseSentId + index

    return {
      sentId,
      index,
      rawSent,
      tokens: tokenizeSentenceWords(rawSent, language, sentId),
    }
  })
}

export async function tokenizeDialogueTextServer(text: string, language: string, baseSentId = 0): Promise<TokenizedSentence[]> {
  try {
    const serverResult = await requestNlpTokenize(text, language, baseSentId)

    if (serverResult?.sentences?.length) {
      return serverResult.sentences.map((sent, index) => ({
        sentId: sent.sentId,
        index,
        rawSent: sent.rawSent,
        tokens: sent.tokens,
      }))
    }
  }
  catch (err) {
    console.warn('[DialogueTokenizer] Server tokenization fallback to local Segmenter:', err)
  }

  return tokenizeDialogueText(text, language, baseSentId)
}
