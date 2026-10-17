import type { LlmAnalysis, WordAutoFillResponse } from '../../types'
import { missingWordContentFields } from '@injurka/insight-book-language-utils'
import { decompressData } from '../../utils/compression'

export function contentOf(value: Partial<WordAutoFillResponse>): WordAutoFillResponse | null {
  if (typeof value.translation !== 'string' || !value.translation.trim())
    return null
  const text = (key: keyof WordAutoFillResponse) => typeof value[key] === 'string' ? value[key] : ''
  return { translation: value.translation, transcription: text('transcription'), difficulty: text('difficulty'), tags: text('tags'), grammarNote: text('grammarNote'), vocabularyNote: text('vocabularyNote') }
}

export function cachedContentOf(analysis: Parameters<typeof decompressData>[0]): WordAutoFillResponse | null {
  try {
    const parsed: LlmAnalysis = JSON.parse(decompressData(analysis))
    return contentOf({
      ...parsed,
      grammarNote: contentOf(parsed)?.grammarNote || (Array.isArray(parsed.grammarRules) ? parsed.grammarRules.filter(r => typeof r.pattern === 'string' && typeof r.explanation === 'string').map(r => `${r.pattern} — ${r.explanation}`).join('\n') : ''),
      vocabularyNote: contentOf(parsed)?.vocabularyNote || (Array.isArray(parsed.vocabulary) ? parsed.vocabulary.filter(v => typeof v.word === 'string' && typeof v.meaning === 'string').map(v => `${v.word} — ${v.meaning}`).join('\n') : ''),
    })
  }
  catch { return null }
}

export function completeContent(current: WordAutoFillResponse | null, fallback: WordAutoFillResponse | null): WordAutoFillResponse | null {
  if (!current || !fallback)
    return current || fallback
  const result = { ...current }
  const missingRequired = new Set<string>(missingWordContentFields(current))
  for (const field of Object.keys(result) as (keyof WordAutoFillResponse)[]) {
    if (!result[field]?.trim() || missingRequired.has(field))
      result[field] = fallback[field]
  }
  return result
}
