import type { UserDictItem } from '~/01.shared/types/models'
import { beforeAll, describe, expect, it } from 'vitest'
import { i18n } from '~/00.plugins/i18n'
import { useSrsQuiz } from './use-srs-quiz'

function makeWord(overrides: Partial<UserDictItem> = {}): UserDictItem {
  return {
    id: 1,
    deckIds: [],
    word: 'word',
    transcription: null,
    translation: 'translation',
    language: 'en',
    targetLanguage: 'ru',
    notes: null,
    tags: null,
    difficulty: null,
    grammarNote: null,
    vocabularyNote: null,
    state: 0,
    due: '',
    stability: 0,
    difficultyFsrs: 0,
    scheduledDays: 0,
    reps: 0,
    ...overrides,
  } as UserDictItem
}

beforeAll(() => {
  // Локали в тестах не загружаются автоматически — задаём fallback-слова явно
  i18n.global.setLocaleMessage('ru', {
    srs: { fallbackWords: 'FbOne,FbTwo,FbThree,FbFour,FbFive' },
  })
})

describe('useSrsQuiz', () => {
  // getLevenshteinDistance не экспортируется напрямую,
  // поэтому проверяем расстояния через публичный checkTypo
  describe('checkTypo (getLevenshteinDistance)', () => {
    it('treats identical strings as correct (distance 0)', () => {
      const { checkTypo } = useSrsQuiz()
      expect(checkTypo('hello', 'hello')).toEqual({ isCorrect: true, isTypo: false })
    })

    it('treats two empty strings as correct (distance 0)', () => {
      const { checkTypo } = useSrsQuiz()
      expect(checkTypo('', '')).toEqual({ isCorrect: true, isTypo: false })
    })

    it('treats empty input against non-empty word as a typo when within tolerance', () => {
      const { checkTypo } = useSrsQuiz()
      // distance('', 'ab') = 2 > tolerance 1
      expect(checkTypo('', 'ab')).toEqual({ isCorrect: false, isTypo: false })
      // distance('', 'a') = 1 <= tolerance 1
      expect(checkTypo('', 'a')).toEqual({ isCorrect: false, isTypo: true })
    })

    it('detects a single substitution as a typo (distance 1)', () => {
      const { checkTypo } = useSrsQuiz()
      expect(checkTypo('bat', 'cat')).toEqual({ isCorrect: false, isTypo: true })
    })

    it('detects a single insertion as a typo (distance 1)', () => {
      const { checkTypo } = useSrsQuiz()
      expect(checkTypo('cats', 'cat')).toEqual({ isCorrect: false, isTypo: true })
    })

    it('detects a single deletion as a typo (distance 1)', () => {
      const { checkTypo } = useSrsQuiz()
      expect(checkTypo('ct', 'cat')).toEqual({ isCorrect: false, isTypo: true })
    })

    it('works with cyrillic strings', () => {
      const { checkTypo } = useSrsQuiz()
      expect(checkTypo('код', 'кот')).toEqual({ isCorrect: false, isTypo: true })
      expect(checkTypo('кот', 'кот')).toEqual({ isCorrect: true, isTypo: false })
    })

    it('works with hieroglyphs', () => {
      const { checkTypo } = useSrsQuiz()
      expect(checkTypo('汉字', '汉字')).toEqual({ isCorrect: true, isTypo: false })
      expect(checkTypo('汉子', '汉字')).toEqual({ isCorrect: false, isTypo: true })
    })

    it('ignores case and surrounding whitespace', () => {
      const { checkTypo } = useSrsQuiz()
      expect(checkTypo('  HeLLo ', 'hello')).toEqual({ isCorrect: true, isTypo: false })
    })

    it('rejects input with distance above tolerance', () => {
      const { checkTypo } = useSrsQuiz()
      // distance('xyz', 'cat') = 3 > tolerance 1
      expect(checkTypo('xyz', 'cat')).toEqual({ isCorrect: false, isTypo: false })
    })

    it('allows 2 typos for words longer than 5 characters', () => {
      const { checkTypo } = useSrsQuiz()
      // distance('wondaw', 'window') = 2 <= tolerance 2
      expect(checkTypo('wondaw', 'window')).toEqual({ isCorrect: false, isTypo: true })
      // distance('wonday', 'window') = 3 > tolerance 2
      expect(checkTypo('wonday', 'window')).toEqual({ isCorrect: false, isTypo: false })
    })
  })

  describe('generateDistractors', () => {
    it('returns the requested number of distractors', () => {
      const { generateDistractors } = useSrsQuiz()
      const correct = makeWord({ id: 1, translation: 'correct' })
      const pool = [2, 3, 4, 5, 6].map(id => makeWord({ id, translation: `trans${id}` }))

      expect(generateDistractors(correct, pool, 3)).toHaveLength(3)
    })

    it('returns 3 distractors by default', () => {
      const { generateDistractors } = useSrsQuiz()
      const correct = makeWord({ id: 1, translation: 'correct' })
      const pool = [2, 3, 4, 5, 6].map(id => makeWord({ id, translation: `trans${id}` }))

      expect(generateDistractors(correct, pool)).toHaveLength(3)
    })

    it('never includes the correct translation among distractors', () => {
      const { generateDistractors } = useSrsQuiz()
      const correct = makeWord({ id: 1, translation: 'correct' })
      const pool = [2, 3, 4, 5, 6].map(id => makeWord({ id, translation: `trans${id}` }))

      const result = generateDistractors(correct, pool, 3)
      expect(result).not.toContain('correct')
      expect(result).not.toContain(correct.id.toString())
    })

    it('returns unique distractors without duplicates', () => {
      const { generateDistractors } = useSrsQuiz()
      const correct = makeWord({ id: 1, translation: 'correct' })
      // В пуле есть слова с одинаковым переводом
      const pool = [2, 3, 4, 5].map(id => makeWord({ id, translation: 'same' }))

      const result = generateDistractors(correct, pool, 3)
      expect(new Set(result).size).toBe(result.length)
    })

    it('excludes the correct item itself and words of other languages', () => {
      const { generateDistractors } = useSrsQuiz()
      const correct = makeWord({ id: 1, translation: 'correct', language: 'en' })
      const pool = [
        correct,
        makeWord({ id: 2, translation: 'chinese', language: 'zh' }),
        makeWord({ id: 3, translation: 'other' }),
      ]

      const result = generateDistractors(correct, pool, 2)
      expect(result).toContain('other')
      expect(result).not.toContain('chinese')
    })

    it('cleans HTML and takes only the first translation variant', () => {
      const { generateDistractors } = useSrsQuiz()
      const correct = makeWord({ id: 1, translation: 'correct' })
      const pool = [
        makeWord({ id: 2, translation: '<b>first</b>, second; third' }),
      ]

      const result = generateDistractors(correct, pool, 1)
      expect(result).toEqual(['first'])
    })

    it('pads with fallback words when there are fewer candidates than requested', () => {
      const { generateDistractors } = useSrsQuiz()
      const correct = makeWord({ id: 1, translation: 'correct' })
      const pool = [makeWord({ id: 2, translation: 'only' })]

      const result = generateDistractors(correct, pool, 3)
      expect(result).toHaveLength(3)
      expect(result).toContain('only')
      expect(result.filter(d => d.startsWith('Fb'))).toHaveLength(2)
    })

    it('returns fewer distractors than requested when candidates and fallbacks run out', () => {
      const { generateDistractors } = useSrsQuiz()
      const correct = makeWord({ id: 1, translation: 'correct' })

      // Пул пуст, фолбеков в тестовой локали всего 5
      const result = generateDistractors(correct, [], 10)
      expect(result).toHaveLength(5)
      expect(new Set(result).size).toBe(5)
    })

    it('excludes the correct translation when it matches a fallback word', () => {
      const { generateDistractors } = useSrsQuiz()
      // Фолбек, совпадающий с правильным переводом, пропускается
      const correct = makeWord({ id: 1, translation: 'FbOne' })

      const result = generateDistractors(correct, [], 3)
      expect(result).not.toContain('FbOne')
      expect(result).toHaveLength(3)
    })
  })

  describe('generateWordDistractors', () => {
    it('returns the requested number of word distractors', () => {
      const { generateWordDistractors } = useSrsQuiz()
      const correct = makeWord({ id: 1, word: 'apple', language: 'en' })
      const pool = [2, 3, 4, 5].map(id => makeWord({ id, word: `word${id}` }))

      expect(generateWordDistractors(correct, pool, 3)).toHaveLength(3)
    })

    it('excludes the correct word and never duplicates distractors', () => {
      const { generateWordDistractors } = useSrsQuiz()
      const correct = makeWord({ id: 1, word: 'apple', language: 'en' })
      const pool = [
        makeWord({ id: 1, word: 'apple' }),
        makeWord({ id: 2, word: 'apple' }), // то же слово другим элементом
        makeWord({ id: 3, word: 'pear' }),
        makeWord({ id: 4, word: 'plum' }),
      ]

      const result = generateWordDistractors(correct, pool, 3)
      expect(result).not.toContain('apple')
      expect(new Set(result).size).toBe(result.length)
    })

    it('uses only words of the same language', () => {
      const { generateWordDistractors } = useSrsQuiz()
      const correct = makeWord({ id: 1, word: 'apple', language: 'en' })
      const pool = [
        makeWord({ id: 2, word: '苹果', language: 'zh' }),
        makeWord({ id: 3, word: 'pear', language: 'en' }),
      ]

      const result = generateWordDistractors(correct, pool, 2)
      expect(result).toContain('pear')
      expect(result).not.toContain('苹果')
    })

    it('pads with built-in fallback hieroglyphs when candidates are scarce', () => {
      const { generateWordDistractors } = useSrsQuiz()
      const correct = makeWord({ id: 1, word: '猫', language: 'zh' })

      const result = generateWordDistractors(correct, [], 3)
      expect(result).toHaveLength(3)
      for (const d of result)
        expect(['的', '一', '是', '不', '了', '人', '我', '在', '有', '他']).toContain(d)
    })

    it('skips fallback hieroglyphs equal to the correct word', () => {
      const { generateWordDistractors } = useSrsQuiz()
      const correct = makeWord({ id: 1, word: '的', language: 'zh' })

      const result = generateWordDistractors(correct, [], 3)
      expect(result).toHaveLength(3)
      expect(result).not.toContain('的')
    })

    it('returns fewer distractors than requested when candidates and fallbacks run out', () => {
      const { generateWordDistractors } = useSrsQuiz()
      const correct = makeWord({ id: 1, word: '猫', language: 'zh' })

      // Фолбеков всего 10, запрашиваем больше
      const result = generateWordDistractors(correct, [], 15)
      expect(result).toHaveLength(10)
      expect(new Set(result).size).toBe(10)
    })
  })
})
