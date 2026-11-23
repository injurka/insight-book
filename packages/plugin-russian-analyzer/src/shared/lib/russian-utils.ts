import type {
  MorphemeType,
  RussianCaseCode,
  RussianPosCode,
} from '../../modules/russian-analyzer/model'

const CYRILLIC_REGEX = /\p{Script=Cyrillic}/u
const HAN_REGEX = /\p{Script=Han}/u
const LATIN_REGEX = /[a-z]/i
const COMBINING_ACUTE_REGEX = /\u0301/g

export function detectRussianAnalyzerInputLanguage(text: string): 'ru' | 'zh' | 'en' | 'auto' {
  const clean = text.trim()

  if (!clean) {
    return 'auto'
  }

  if (CYRILLIC_REGEX.test(clean)) {
    return 'ru'
  }

  if (HAN_REGEX.test(clean)) {
    return 'zh'
  }

  if (LATIN_REGEX.test(clean)) {
    return 'en'
  }

  return 'en'
}

export function stripStressMarks(text: string): string {
  return text.replace(COMBINING_ACUTE_REGEX, '')
}

export function getPosClass(pos: RussianPosCode): string {
  const valid: RussianPosCode[] = [
    'noun',
    'verb',
    'adj',
    'adv',
    'pron',
    'prep',
    'particle',
    'conj',
    'num',
    'participle',
    'other',
  ]

  return valid.includes(pos) ? `pos-${pos}` : 'pos-other'
}

export function getCaseClass(caseCode: RussianCaseCode): string {
  const valid: RussianCaseCode[] = ['nom', 'gen', 'dat', 'acc', 'ins', 'loc']

  return valid.includes(caseCode) ? `case-${caseCode}` : 'case-none'
}

export function getMorphemeClass(type: MorphemeType): string {
  const valid: MorphemeType[] = ['prefix', 'root', 'suffix', 'ending', 'postfix']

  return valid.includes(type) ? `morph-${type}` : 'morph-root'
}

export function getMorphemeShortSymbol(type: MorphemeType): string {
  switch (type) {
    case 'prefix':
      return '¬'
    case 'root':
      return '⌒'
    case 'suffix':
      return '∧'
    case 'ending':
      return '□'
    case 'postfix':
      return '⌙'
    default:
      return '·'
  }
}
