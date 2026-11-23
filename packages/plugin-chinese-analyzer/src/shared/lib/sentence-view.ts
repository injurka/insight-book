import type {
  ChineseSentenceAnalysis,
  PhoneticsAnalysis,
  SentenceOverview,
  SyllableTonePoint,
} from '../../modules/chinese-analyzer/model'
import type { TokenSentenceGroup } from './sentence-segmentation'
import {
  groupSyllablesBySentence,
  groupTokensBySentence,
  splitFormulaIntoLines,
  splitRhythmIntoSentenceRows,
  splitTextIntoSentenceLines,
} from './sentence-segmentation'

export interface SentenceTab {
  /** Ключ предложения (`sentenceIndex` токенов). */
  index: number
  /** Порядковый номер для отображения, с 1. */
  order: number
  hanzi: string
}

interface SentenceScoped {
  sentenceIndex?: number
}

function joinGroupHanzi(group: TokenSentenceGroup): string {
  return group.items.map(item => item.token.hanzi + item.trailingPunctuation).join('')
}

function sumCharacters(group: TokenSentenceGroup): number {
  return group.items.reduce((sum, item) => sum + item.token.characters.length, 0)
}

/** Элемент без `sentenceIndex` относится ко всему тексту и показывается в любом предложении. */
function isInSentence(item: SentenceScoped, sentenceIndex: number): boolean {
  return item.sentenceIndex === undefined || item.sentenceIndex === sentenceIndex
}

/** Строка предложения из многострочного поля; если строк не столько же, сколько предложений — поле целиком. */
function pickLine(
  lines: string[],
  fullText: string,
  position: number,
  count: number,
): string {
  return lines.length === count ? lines[position] : fullText
}

function sliceSyllables(analysis: ChineseSentenceAnalysis, groups: TokenSentenceGroup[], position: number): SyllableTonePoint[] {
  const { syllables } = analysis.phonetics
  const charCounts = groups.map(sumCharacters)

  // Слог на иероглиф: границы предложений совпадают с границами токенов.
  if (syllables.length === charCounts.reduce((a, b) => a + b, 0)) {
    const start = charCounts.slice(0, position).reduce((a, b) => a + b, 0)

    return syllables.slice(start, start + charCounts[position])
  }

  const syllableGroups = groupSyllablesBySentence(analysis.sentence.hanzi, syllables)

  return syllableGroups.length === groups.length ? syllableGroups[position].syllables : syllables
}

function slicePhonetics(
  analysis: ChineseSentenceAnalysis,
  groups: TokenSentenceGroup[],
  position: number,
  sentenceIndex: number,
): PhoneticsAnalysis {
  const { phonetics } = analysis
  const rhythmRows = splitRhythmIntoSentenceRows(phonetics.rhythmGrouping)

  return {
    ...phonetics,
    rhythmGrouping: rhythmRows.length === groups.length
      ? rhythmRows[position].join(' / ')
      : phonetics.rhythmGrouping,
    sandhiRules: phonetics.sandhiRules.filter(rule => isInSentence(rule, sentenceIndex)),
    syllables: sliceSyllables(analysis, groups, position),
  }
}

function sliceOverview(analysis: ChineseSentenceAnalysis, groups: TokenSentenceGroup[], position: number): SentenceOverview {
  const { sentence } = analysis
  const count = groups.length
  const group = groups[position]

  return {
    ...sentence,
    hanzi: joinGroupHanzi(group),
    pinyin: group.items.map(item => item.token.pinyin).join(' '),
    translation: pickLine(
      splitTextIntoSentenceLines(sentence.translation),
      sentence.translation,
      position,
      count,
    ),
    literalTranslation: pickLine(
      splitTextIntoSentenceLines(sentence.literalTranslation),
      sentence.literalTranslation,
      position,
      count,
    ),
    structuralFormula: pickLine(
      splitFormulaIntoLines(sentence.structuralFormula),
      sentence.structuralFormula,
      position,
      count,
    ),
  }
}

/** Список предложений для переключателя. Пусто, если предложение одно. */
export function getSentenceTabs(analysis: ChineseSentenceAnalysis): SentenceTab[] {
  const groups = groupTokensBySentence(analysis.sentence.hanzi, analysis.tokens)

  if (groups.length < 2) {
    return []
  }

  return groups.map((group, position) => ({
    index: group.sentenceIndex,
    order: position + 1,
    hanzi: joinGroupHanzi(group),
  }))
}

/**
 * Срез разбора по одному предложению. Возвращает объект того же типа, поэтому
 * все карточки работают с ним без изменений. Неизвестный индекс → исходный разбор.
 */
export function sliceAnalysisBySentence(analysis: ChineseSentenceAnalysis, sentenceIndex: number): ChineseSentenceAnalysis {
  const groups = groupTokensBySentence(analysis.sentence.hanzi, analysis.tokens)
  const position = groups.findIndex(group => group.sentenceIndex === sentenceIndex)

  if (groups.length < 2 || position === -1) {
    return analysis
  }

  const tokens = groups[position].items.map(item => item.token)
  const tokenIds = new Set(tokens.map(token => token.id))

  return {
    sentence: sliceOverview(analysis, groups, position),
    tokens,
    clauses: analysis.clauses
      .filter(clause => clause.tokenIds.some(id => tokenIds.has(id)))
      .map(clause => ({ ...clause, tokenIds: clause.tokenIds.filter(id => tokenIds.has(id)) })),
    dependencies: analysis.dependencies.filter(dep => tokenIds.has(dep.fromTokenId) && tokenIds.has(dep.toTokenId)),
    phonetics: slicePhonetics(
      analysis,
      groups,
      position,
      sentenceIndex,
    ),
    grammarPatterns: analysis.grammarPatterns.filter(pattern => isInSentence(pattern, sentenceIndex)),
    usageContext: analysis.usageContext,
    alternatives: analysis.alternatives.filter(variant => isInSentence(variant, sentenceIndex)),
  }
}
