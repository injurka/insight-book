import type { LlmConfig } from '../types'
import { generateLevelQuiz } from '~/services/llm.service'
import { quizRepository } from '../repositories/quiz.repository'
import { AppError } from '../utils/errors'

export const QUIZ_DIFFICULTY_SYSTEMS: Record<string, string[]> = {
  zh: ['HSK 1', 'HSK 2', 'HSK 3', 'HSK 4', 'HSK 5', 'HSK 6'],
  ja: ['JLPT N5', 'JLPT N4', 'JLPT N3', 'JLPT N2', 'JLPT N1'],
  default: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'],
}

export const quizService = {
  getLevelsForLanguage(lang: string): string[] {
    return QUIZ_DIFFICULTY_SYSTEMS[lang] || QUIZ_DIFFICULTY_SYSTEMS.default
  },

  async getQuizLevels(userId: number, language: string) {
    const levelsList = this.getLevelsForLanguage(language)
    const rawProgressList = await quizRepository.getRawProgressList(userId, language)

    const levelToProgressMap: Record<string, typeof rawProgressList[0]> = {}
    const duplicateIdsToDelete: number[] = []

    for (const item of rawProgressList) {
      const existing = levelToProgressMap[item.levelValue]
      if (!existing) {
        levelToProgressMap[item.levelValue] = item
      }
      else {
        if (item.bestScore > existing.bestScore || (item.bestScore === existing.bestScore && item.stars > existing.stars) || item.unlocked) {
          duplicateIdsToDelete.push(existing.id)
          levelToProgressMap[item.levelValue] = item
        }
        else {
          duplicateIdsToDelete.push(item.id)
        }
      }
    }

    if (duplicateIdsToDelete.length > 0) {
      await quizRepository.deleteProgressIds(duplicateIdsToDelete)
    }

    const progressList = Object.values(levelToProgressMap)

    if (progressList.length === 0 && levelsList.length > 0) {
      const inserts = levelsList.map((lvl, index) => ({
        userId,
        language,
        levelValue: lvl,
        bestScore: 0,
        stars: 0,
        unlocked: index === 0,
      }))
      await quizRepository.insertProgressBatch(inserts)
      return await quizRepository.getRawProgressList(userId, language)
    }

    const existingLevels = new Set(progressList.map(p => p.levelValue))
    const missingLevels = levelsList.filter(lvl => !existingLevels.has(lvl))

    if (missingLevels.length > 0) {
      const missingInserts = missingLevels.map((lvl) => {
        const idx = levelsList.indexOf(lvl)
        return {
          userId,
          language,
          levelValue: lvl,
          bestScore: 0,
          stars: 0,
          unlocked: idx === 0,
        }
      })
      await quizRepository.insertProgressBatch(missingInserts)
      return await quizRepository.getRawProgressList(userId, language)
    }

    return progressList
  },

  async generateQuiz(userId: number, normalizedLang: string, targetLang: string, levelValue: string, config: LlmConfig) {
    const progress = await quizRepository.getProgressForLevel(userId, normalizedLang, levelValue)

    if (!progress || !progress.unlocked) {
      throw new AppError(403, 'quiz_level_locked')
    }

    const deck = await quizRepository.getOfficialDeck(normalizedLang, levelValue)

    if (!deck) {
      throw new AppError(404, `quiz_deck_not_found:${levelValue}:${normalizedLang}`)
    }

    const deckWords = await quizRepository.getDeckWords(deck.id)

    if (deckWords.length === 0) {
      throw new AppError(404, 'quiz_no_words')
    }

    const wordsSample = deckWords
      .map(w => w.word)
      .sort(() => 0.5 - Math.random())
      .slice(0, 40)

    const questions = await generateLevelQuiz(userId, normalizedLang, targetLang, levelValue, wordsSample, config)
    return { questions }
  },

  async submitQuiz(userId: number, normalizedLang: string, levelValue: string, score: number) {
    let starsEarned = 0
    const isPassed = score >= 80

    if (isPassed) {
      if (score === 100)
        starsEarned = 3
      else if (score >= 90)
        starsEarned = 2
      else starsEarned = 1
    }

    const currentProgress = await quizRepository.getProgressForLevel(userId, normalizedLang, levelValue)
    const bestScore = currentProgress ? Math.max(currentProgress.bestScore, score) : score
    const stars = currentProgress ? Math.max(currentProgress.stars, starsEarned) : starsEarned

    if (currentProgress) {
      await quizRepository.updateProgress(currentProgress.id, {
        bestScore,
        stars,
        updatedAt: new Date().toISOString(),
      })
    }
    else {
      await quizRepository.insertProgress({
        userId,
        language: normalizedLang,
        levelValue,
        bestScore,
        stars,
        unlocked: true,
        updatedAt: new Date().toISOString(),
      })
    }

    let nextLevelUnlocked = false
    let nextLevelValue: string | null = null

    if (isPassed) {
      const levelsList = this.getLevelsForLanguage(normalizedLang)
      const currentIdx = levelsList.indexOf(levelValue)

      if (currentIdx !== -1 && currentIdx + 1 < levelsList.length) {
        nextLevelValue = levelsList[currentIdx + 1]
        const nextProgress = await quizRepository.getProgressForLevel(userId, normalizedLang, nextLevelValue)

        if (!nextProgress) {
          await quizRepository.insertProgress({
            userId,
            language: normalizedLang,
            levelValue: nextLevelValue,
            bestScore: 0,
            stars: 0,
            unlocked: true,
          })
          nextLevelUnlocked = true
        }
        else if (!nextProgress.unlocked) {
          await quizRepository.updateProgress(nextProgress.id, { unlocked: true })
          nextLevelUnlocked = true
        }
      }
    }

    return {
      success: true,
      score,
      starsEarned,
      isPassed,
      nextLevelUnlocked,
      nextLevelValue,
    }
  },
}
