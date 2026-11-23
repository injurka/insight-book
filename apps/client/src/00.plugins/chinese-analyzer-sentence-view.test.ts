import { describe, expect, it } from 'vitest'
import { DEFAULT_SHOWCASE_ANALYSIS } from '../../../../packages/plugin-chinese-analyzer/src/shared/constants/presets'
import { sliceAnalysisBySentence } from '../../../../packages/plugin-chinese-analyzer/src/shared/lib/sentence-view'
import { buildFallbackSyllables } from '../../../../packages/plugin-chinese-analyzer/src/shared/lib/tone-utils'

const first = { ...DEFAULT_SHOWCASE_ANALYSIS.tokens[0], sentenceIndex: 0 }
const second = { ...DEFAULT_SHOWCASE_ANALYSIS.tokens[1], sentenceIndex: 1 }
const analysis = {
  ...DEFAULT_SHOWCASE_ANALYSIS,
  sentence: { ...DEFAULT_SHOWCASE_ANALYSIS.sentence, hanzi: `${first.hanzi}。${second.hanzi}……` },
  tokens: [first, second],
}
const firstSyllables = buildFallbackSyllables([first])
const secondSyllables = buildFallbackSyllables([second])

describe('chinese tone contour for a selected sentence', () => {
  it('uses the selected tokens if saved phonetics cover only the first sentence', () => {
    const result = sliceAnalysisBySentence({
      ...analysis,
      phonetics: { ...analysis.phonetics, syllables: firstSyllables, rhythmGrouping: first.hanzi },
    }, 1)

    expect(result.phonetics.syllables).toEqual(secondSyllables)
    expect(result.phonetics.rhythmGrouping).toBe(result.sentence.hanzi)
  })

  it('rejects unrelated syllables even when the total count matches', () => {
    const syllables = [...firstSyllables, ...secondSyllables.map(() => firstSyllables[0])]
    const result = sliceAnalysisBySentence({
      ...analysis,
      phonetics: { ...analysis.phonetics, syllables },
    }, 1)

    expect(result.phonetics.syllables).toEqual(secondSyllables)
  })

  it('keeps generated tones when the syllables match the selected sentence', () => {
    const generated = secondSyllables.map(item => ({ ...item, sandhiApplied: true }))
    const result = sliceAnalysisBySentence({
      ...analysis,
      phonetics: { ...analysis.phonetics, syllables: [...firstSyllables, ...generated] },
    }, 1)

    expect(result.phonetics.syllables).toEqual(generated)
  })
})
