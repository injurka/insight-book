import type { UserDictItem } from '~/shared/types/models'
import { i18n } from '~/shared/plugins/i18n'

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
      if (a[i - 1] === b[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1]
      }
      else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1,
        )
      }
    }
  }

  return matrix[a.length][b.length]
}

export function useSrsQuiz() {
  function generateDistractors(correctItem: UserDictItem, allWords: UserDictItem[], count = 3): string[] {
    const distractors = new Set<string>()
    const pool = allWords.filter(w => w.id !== correctItem.id && w.language === correctItem.language && w.translation)

    // Перемешиваем пул, чтобы варианты каждый раз были уникальными
    const shuffled = [...pool].sort(() => 0.5 - Math.random())

    for (const w of shuffled) {
      if (distractors.size >= count)
        break
      if (w.translation) {
        // Очищаем HTML и берем только первое значение (чтобы варианты не были слишком длинными)
        const cleanTrans = w.translation.split(',')[0].split(';')[0].replace(/<[^>]+(>|$)/g, '').trim()
        const correctClean = correctItem.translation?.split(',')[0].split(';')[0].replace(/<[^>]+(>|$)/g, '').trim()

        if (cleanTrans && cleanTrans !== correctClean) {
          distractors.add(cleanTrans)
        }
      }
    }

    // Фолбеки на случай, если в словаре пользователя мало слов
    const fallbacks = (i18n.global.t('srs.fallbackWords') as string).split(',')
    let i = 0
    while (distractors.size < count && i < fallbacks.length) {
      distractors.add(fallbacks[i])
      i++
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

    if (distance <= tolerance) {
      return { isCorrect: false, isTypo: true }
    }

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
    checkTypo,
    formatTime,
  }
}
