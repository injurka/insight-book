import type { Mystery, Word } from './types'
import { describe, expect, test } from 'bun:test'
import { dueWords, exactGuess, leaks, nounWords, parseMystery, parseReply } from './contracts'

const word: Word = {
  id: 1,
  word: 'lantern',
  translation: 'фонарь',
  language: 'en',
  due: '2020-01-01T00:00:00Z',
  transcription: '',
}
const mystery: Mystery = { introduction: 'В сумерках это особенно полезно.', facts: ['Вещь.', 'Неживая.', 'Рукотворная.', 'Даёт свет.'], hints: ['Сделано человеком.', 'Помогает вечером.', 'Внутри бывает свеча.'] }

describe('SRS queue and noun classification', () => {
  test('excludes future, other languages and malformed cards; deduplicates by meaning', () => {
    expect(dueWords([word, { ...word, id: 2 }, { ...word, id: 3, due: '2100-01-01' }, { ...word, id: 4, language: 'zh' }, { ...word, id: 5, due: 'broken' }, { ...word, id: 6, translation: '' }], 'en', Date.parse('2026-01-01'))).toEqual([word])
  })
  test('preserves different senses of a homograph', () => {
    expect(dueWords([word, { ...word, id: 2, translation: 'лампа' }], 'en')).toHaveLength(2)
  })
  test('accepts only confirmed playable nouns', () => {
    const words = [word, { ...word, id: 2, word: 'run', translation: 'бежать' }]
    expect(nounWords({ items: [{ id: 1, noun: true, playable: true }, { id: 2, noun: false, playable: true }] }, words)).toEqual([word])
  })
  test('rejects partial, duplicate, invented and loosely typed classifications', () => {
    for (const items of [[], [{ id: 9, noun: true, playable: true }], [{ id: 1, noun: 'true', playable: true }]])
      expect(() => nounWords({ items }, [word])).toThrow()

    expect(() => nounWords({ items: [{ id: 1, noun: true, playable: true }, { id: 1, noun: true, playable: true }] }, [word, { ...word, id: 2 }])).toThrow()
  })
})
describe('fair secret and moves', () => {
  test('normalizes spelling and English articles without accepting substrings or translations', () => {
    expect(exactGuess(' THE Lantern! ', 'lantern')).toBe(true)
    expect(exactGuess('ｌａｎｔｅｒｎ', 'lantern')).toBe(true)
    expect(exactGuess('lanterns', 'lantern')).toBe(false)
    expect(exactGuess('not a lantern', 'lantern')).toBe(false)
    expect(exactGuess('фонарь', 'lantern')).toBe(false)
  })
  test('detects translations and CJK leaks, without matching Latin substrings', () => {
    expect(leaks('Это фонарь.', word)).toBe(true)
    expect(leaks('Lantern!', word)).toBe(true)
    expect(leaks('A lanternfish lives in water.', word)).toBe(false)
    expect(leaks('这是灯笼。', { ...word, word: '灯笼' })).toBe(true)
  })
  test('requires a complete mystery with no answer in visible text', () => {
    expect(parseMystery(mystery, word)).toEqual(mystery)
    expect(() => parseMystery({ ...mystery, hints: ['Это фонарь.', 'второе', 'третье'] }, word)).toThrow()
    expect(() => parseMystery({ ...mystery, facts: [] }, word)).toThrow()
    expect(() => parseMystery({ ...mystery, introduction: '' }, word)).toThrow()
  })
  test('AI cannot declare a win or smuggle free text into the rendered reply', () => {
    expect(() => parseReply({ verdict: 'solved', direction: 'closer' }, 'guess')).toThrow()
    expect(() => parseReply({ verdict: 'almost', direction: 'closer' }, 'question')).toThrow()
    expect(parseReply({ verdict: 'yes', direction: 'closer', text: 'The answer is lantern' }, 'question')).toEqual({ verdict: 'yes', direction: 'closer' })
  })
  test('invalid JSON and enum values never become a plausible answer', () => {
    expect(() => parseReply('not json', 'question')).toThrow()
    expect(() => parseReply({ verdict: 'yes', direction: 99 }, 'question')).toThrow()
  })
})
