import type { PartOfSpeechCode, ToneNumber } from '../../modules/chinese-analyzer/model'

const HAN_REGEX = /\p{Script=Han}/u
const CYRILLIC_REGEX = /\p{Script=Cyrillic}/u

const TONE_1_CHARS = /[āēīōūǖ]/i
const TONE_2_CHARS = /[áéíóúǘ]/i
const TONE_3_CHARS = /[ǎěǐǒǔǚ]/i
const TONE_4_CHARS = /[àèìòùǜ]/i

export function detectInputLanguage(text: string): 'zh' | 'ru' | 'auto' {
  const clean = text.trim()

  if (!clean) {
    return 'auto'
  }

  if (HAN_REGEX.test(clean)) {
    return 'zh'
  }

  if (CYRILLIC_REGEX.test(clean)) {
    return 'ru'
  }

  return 'ru'
}

export function extractToneFromPinyinSyllable(syllable: string): ToneNumber {
  if (TONE_1_CHARS.test(syllable) || syllable.endsWith('1')) {
    return 1
  }

  if (TONE_2_CHARS.test(syllable) || syllable.endsWith('2')) {
    return 2
  }

  if (TONE_3_CHARS.test(syllable) || syllable.endsWith('3')) {
    return 3
  }

  if (TONE_4_CHARS.test(syllable) || syllable.endsWith('4')) {
    return 4
  }

  return 5
}

export function normalizeToneNumber(val: unknown, fallbackPinyin = ''): ToneNumber {
  const num = Number(val)

  if (num === 1 || num === 2 || num === 3 || num === 4 || num === 5) {
    return num
  }

  if (fallbackPinyin) {
    return extractToneFromPinyinSyllable(fallbackPinyin)
  }

  return 5
}

export function getToneBadgeLabel(tone: ToneNumber): string {
  switch (tone) {
    case 1:
      return '1-й тон (55 ¯)'
    case 2:
      return '2-й тон (35 ´)'
    case 3:
      return '3-й тон (214 ˇ)'
    case 4:
      return '4-й тон (51 `)'
    default:
      return 'Нейтр. тон (轻声)'
  }
}

export function getTonePitchTriplet(tone: ToneNumber): [number, number, number] {
  switch (tone) {
    case 1:
      return [5, 5, 5]
    case 2:
      return [3, 4, 5]
    case 3:
      return [2.2, 1, 3.6]
    case 4:
      return [5, 3, 1]
    default:
      return [2.6, 2.5, 2.5]
  }
}

export function getPosClass(pos: PartOfSpeechCode): string {
  const valid: PartOfSpeechCode[] = [
    'noun',
    'verb',
    'adj',
    'adv',
    'pron',
    'prep',
    'particle',
    'measure',
    'conj',
    'idiom',
    'num',
    'other',
  ]

  return valid.includes(pos) ? `pos-${pos}` : 'pos-other'
}
