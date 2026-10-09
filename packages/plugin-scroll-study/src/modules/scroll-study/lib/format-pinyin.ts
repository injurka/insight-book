const toneMarks = {
  1: '\u0304',
  2: '\u0301',
  3: '\u030C',
  4: '\u0300',
} as const

function getTonePosition(syllable: string): number {
  const lower = syllable.toLowerCase()
  const a = lower.indexOf('a')

  if (a !== -1)
    return a

  const e = lower.indexOf('e')

  if (e !== -1)
    return e

  const ou = lower.indexOf('ou')

  if (ou !== -1)
    return ou

  for (let i = lower.length - 1; i >= 0; i--) {
    if ('iouü'.includes(lower[i]!))
      return i
  }

  return -1
}

function formatSyllable(syllable: string, tone: number): string {
  const position = getTonePosition(syllable)
  const toneMark = toneMarks[tone as keyof typeof toneMarks]

  if (position === -1 || !toneMark)
    return syllable

  const vowel = syllable[position]!
  const accentedVowel = `${vowel.normalize('NFD')}${toneMark}`.normalize('NFC')

  return `${syllable.slice(0, position)}${accentedVowel}${syllable.slice(position + 1)}`
}

/** Converts numbered Pinyin to standard tone marks while preserving separators and alternatives. */
export function formatPinyin(pinyin: string): string {
  return pinyin.replace(/([A-Zü:]+)([0-5])/gi, (_match, rawSyllable: string, rawTone: string) => {
    const syllable = rawSyllable
      .replace(/u:/gi, match => match[0] === 'U' ? 'Ü' : 'ü')
      .replace(/v/gi, match => match === 'V' ? 'Ü' : 'ü')
    const tone = Number(rawTone)

    return tone === 0 || tone === 5 ? syllable : formatSyllable(syllable, tone)
  })
}
