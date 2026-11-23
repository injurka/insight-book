import type {
  RussianPhoneticsAnalysis,
  RussianSentenceAnalysis,
  RussianSentenceOverview,
  WordPhoneticCard,
} from '../../modules/russian-analyzer/model'
import type { TokenSentenceGroup } from './sentence-segmentation'
import {
  groupTokensBySentence,
  groupWordCardsBySentence,
  splitFormulaIntoLines,
  splitRhythmIntoSentenceRows,
  splitTextIntoSentenceLines,
} from './sentence-segmentation'

export interface SentenceTab {
  /** Ключ предложения (`sentenceIndex` токенов). */
  index: number
  /** Порядковый номер для отображения, с 1. */
  order: number
  text: string
  stressedText: string
}

interface SentenceScoped {
  sentenceIndex?: number
}

function joinGroupText(group: TokenSentenceGroup, stressed: boolean): string {
  return group.items
    .map(item => (stressed ? item.token.stressedWord : item.token.word) + item.trailingPunctuation)
    .join(' ')
    .trim()
}

function isInSentence(item: SentenceScoped, sentenceIndex: number): boolean {
  return item.sentenceIndex === undefined || item.sentenceIndex === sentenceIndex
}

function pickLine(
  lines: string[],
  fullText: string,
  position: number,
  count: number,
): string {
  return lines.length === count ? lines[position] : fullText
}

function sliceWordCards(analysis: RussianSentenceAnalysis, groups: TokenSentenceGroup[], position: number): WordPhoneticCard[] {
  const { wordStressCards } = analysis.phonetics
  const tokenCounts = groups.map(group => group.items.length)

  if (wordStressCards.length === tokenCounts.reduce((a, b) => a + b, 0)) {
    const start = tokenCounts.slice(0, position).reduce((a, b) => a + b, 0)

    return wordStressCards.slice(start, start + tokenCounts[position])
  }

  const cardGroups = groupWordCardsBySentence(analysis.sentence.plainText, wordStressCards)

  return cardGroups.length === groups.length ? cardGroups[position].cards : wordStressCards
}

function slicePhonetics(
  analysis: RussianSentenceAnalysis,
  groups: TokenSentenceGroup[],
  position: number,
  sentenceIndex: number,
): RussianPhoneticsAnalysis {
  const { phonetics } = analysis
  const rhythmRows = splitRhythmIntoSentenceRows(phonetics.rhythmGrouping)

  return {
    ...phonetics,
    rhythmGrouping: rhythmRows.length === groups.length
      ? rhythmRows[position].join(' / ')
      : phonetics.rhythmGrouping,
    phoneticRules: phonetics.phoneticRules.filter(rule => isInSentence(rule, sentenceIndex)),
    wordStressCards: sliceWordCards(analysis, groups, position),
  }
}

function sliceOverview(analysis: RussianSentenceAnalysis, groups: TokenSentenceGroup[], position: number): RussianSentenceOverview {
  const { sentence } = analysis
  const count = groups.length
  const group = groups[position]

  return {
    ...sentence,
    plainText: joinGroupText(group, false),
    stressedText: joinGroupText(group, true),
    ipa: group.items.map(item => item.token.ipa).filter(Boolean).join(' '),
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
export function getSentenceTabs(analysis: RussianSentenceAnalysis): SentenceTab[] {
  const groups = groupTokensBySentence(analysis.sentence.plainText, analysis.tokens)

  if (groups.length < 2) {
    return []
  }

  return groups.map((group, position) => ({
    index: group.sentenceIndex,
    order: position + 1,
    text: joinGroupText(group, false),
    stressedText: joinGroupText(group, true),
  }))
}

/**
 * Срез разбора по одному предложению. Возвращает объект того же типа, поэтому
 * все карточки работают с ним без изменений. Неизвестный индекс → исходный разбор.
 */
export function sliceAnalysisBySentence(analysis: RussianSentenceAnalysis, sentenceIndex: number): RussianSentenceAnalysis {
  const groups = groupTokensBySentence(analysis.sentence.plainText, analysis.tokens)
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
