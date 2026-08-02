import type { UserDictItem } from '~/01.shared/types/models'
import { i18n } from '~/00.plugins/i18n'

// Вычисление расстояния Левенштейна для проверки опечаток
function getLevenshteinDistance(a: string, b: string): number {
  if (a.length === 0)
    return b.length
  if (b.length === 0)
    return a.length

  const matrix = Array.from({ length: a.length + 1 }, () => Array.from({ length: b.length + 1 }).fill(0)) as number[][]

  for (let i = 0; i <= a.length; i++) matrix[i][0] = i
  for (let j = 0; j <= b.length; j++) matrix[0][j] = j

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      if (a[i - 1] === b[j - 1])
        matrix[i][j] = matrix[i - 1][j - 1]

      else
        matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j] + 1)
    }
  }

  return matrix[a.length][b.length]
}

export function useSrsQuiz() {
  function fillFallbackDistractors(distractors: Set<string>, correctClean: string | undefined, count: number) {
    const fallbacks = (i18n.global.t('srs.fallbackWords')).split(',')
    for (const fallbackRaw of fallbacks) {
      if (distractors.size >= count)
        break
      const fallback = fallbackRaw.trim()
      if (fallback && fallback !== correctClean)
        distractors.add(fallback)
    }
  }

  function generateDistractors(correctItem: UserDictItem, allWords: UserDictItem[], count = 3): string[] {
    const distractors = new Set<string>()
    const pool = allWords.filter(wordItem => wordItem.id !== correctItem.id && wordItem.language === correctItem.language && wordItem.translation)

    const shuffled = [...pool].sort(() => 0.5 - Math.random())
    const correctClean = correctItem.translation?.split(',')[0].split(';')[0].replace(/<[^>]+(>|$)/g, '').trim()

    for (const wordItem of shuffled) {
      if (distractors.size >= count)
        break
      if (wordItem.translation) {
        const cleanTrans = wordItem.translation.split(',')[0].split(';')[0].replace(/<[^>]+(>|$)/g, '').trim()
        if (cleanTrans && cleanTrans !== correctClean)
          distractors.add(cleanTrans)
      }
    }

    fillFallbackDistractors(distractors, correctClean, count)

    return Array.from(distractors)
  }

  function generateWordDistractors(correctItem: UserDictItem, allWords: UserDictItem[], count = 3): string[] {
    const distractors = new Set<string>()
    const pool = allWords.filter(wordItem => wordItem.id !== correctItem.id && wordItem.language === correctItem.language && wordItem.word)

    const shuffled = [...pool].sort(() => 0.5 - Math.random())

    for (const wordItem of shuffled) {
      if (distractors.size >= count)
        break
      if (wordItem.word && wordItem.word !== correctItem.word)
        distractors.add(wordItem.word)
    }

    const fallbacks = ['的', '一', '是', '不', '了', '人', '我', '在', '有', '他']
    for (const fallback of fallbacks) {
      if (distractors.size >= count)
        break
      if (fallback !== correctItem.word)
        distractors.add(fallback)
    }

    return Array.from(distractors)
  }

  function checkTypo(input: string, correct: string) {
    const cleanInput = input.trim().toLowerCase()
    const cleanCorrect = correct.trim().toLowerCase()

    if (cleanInput === cleanCorrect)
      return { isCorrect: true, isTypo: false }

    const distance = getLevenshteinDistance(cleanInput, cleanCorrect)
    // Допускаем 1 опечатку для слов до 5 символов, 2 опечатки для более длинных слов
    const tolerance = cleanCorrect.length <= 5 ? 1 : 2

    if (distance <= tolerance)
      return { isCorrect: false, isTypo: true }

    return { isCorrect: false, isTypo: false }
  }

  function formatTime(ms: number) {
    const totalSeconds = Math.floor(ms / 1000)
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    if (minutes === 0)
      return `${seconds} сек`

    return `${minutes} мин ${seconds} сек`
  }

  return {
    generateDistractors,
    generateWordDistractors,
    checkTypo,
    formatTime,
  }
}
