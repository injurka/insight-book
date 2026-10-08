import { normalizeLanguageCode } from '@injurka/insight-book-language-utils'

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

export function splitIntoSentences(text: string, language: string): string[] {
  try {
    const segmenter = new Intl.Segmenter(normalizeLanguageCode(language) || undefined, { granularity: 'sentence' })
    return Array.from(segmenter.segment(text), ({ segment }) => segment)
      .flatMap(splitAtSemicolons)
  }
  catch {
    // Keep delimiters with their sentence and retain every source character.
    return text.match(/[^.。！？…!?;；\n]*(?:[.。！？…!?;；]+[^\S\n]*|\n+|$)/gu)?.filter(Boolean) || []
  }
}
