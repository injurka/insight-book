import { and, eq, or } from 'drizzle-orm'
import { db } from '~/db'
import { catalogDb } from '~/db/catalog'
import { generateLevelQuiz } from '~/services/llm.service'
import { extractLlmConfig, json, normalizeLanguageCode } from '~/utils/helpers'
import { officialDecks, officialDeckWords } from '../db/catalog-schema'
import * as schema from '../db/schema'
import { AppError } from '../utils/errors'

export const QUIZ_DIFFICULTY_SYSTEMS: Record<string, string[]> = {
  zh: ['HSK 1', 'HSK 2', 'HSK 3', 'HSK 4', 'HSK 5', 'HSK 6'],
  ja: ['JLPT N5', 'JLPT N4', 'JLPT N3', 'JLPT N2', 'JLPT N1'],
  default: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'],
}

function getLevelsForLanguage(lang: string): string[] {
  const normalized = normalizeLanguageCode(lang)
  return QUIZ_DIFFICULTY_SYSTEMS[normalized] || QUIZ_DIFFICULTY_SYSTEMS.default
}

export async function handleGetQuizLevels(req: Request, userId: number): Promise<Response> {
  const url = new URL(req.url)
  const language = normalizeLanguageCode(url.searchParams.get('language') || 'zh')

  const levelsList = getLevelsForLanguage(language)

  // Fetch current user progress
  const rawProgressList = await db.select()
    .from(schema.userQuizProgress)
    .where(and(
      eq(schema.userQuizProgress.userId, userId),
      eq(schema.userQuizProgress.language, language),
    ))

  // Deduplicate and delete dirty duplicates from SQLite
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
    await db.delete(schema.userQuizProgress)
      .where(or(...duplicateIdsToDelete.map(id => eq(schema.userQuizProgress.id, id))))
  }

  const progressList = Object.values(levelToProgressMap)

  // If no progress exists, initialize the first level as unlocked, rest as locked
  if (progressList.length === 0 && levelsList.length > 0) {
    const inserts = levelsList.map((lvl, index) => ({
      userId,
      language,
      levelValue: lvl,
      bestScore: 0,
      stars: 0,
      unlocked: index === 0, // First level is unlocked by default
    }))

    await db.insert(schema.userQuizProgress).values(inserts).onConflictDoNothing()

    const newProgress = await db.select()
      .from(schema.userQuizProgress)
      .where(and(
        eq(schema.userQuizProgress.userId, userId),
        eq(schema.userQuizProgress.language, language),
      ))

    return json(newProgress)
  }

  // Ensure all defined levels are present in progressList (e.g. if new levels are added)
  const existingLevels = new Set(progressList.map(p => p.levelValue))
  const missingLevels = levelsList.filter(lvl => !existingLevels.has(lvl))

  if (missingLevels.length > 0) {
    const missingInserts = missingLevels.map((lvl) => {
      // First level is unlocked if it's the only one and nothing exists, else it depends on previous level
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
    await db.insert(schema.userQuizProgress).values(missingInserts).onConflictDoNothing()

    const updatedProgress = await db.select()
      .from(schema.userQuizProgress)
      .where(and(
        eq(schema.userQuizProgress.userId, userId),
        eq(schema.userQuizProgress.language, language),
      ))

    return json(updatedProgress)
  }

  return json(progressList)
}

export async function handleGenerateQuiz(req: Request, userId: number): Promise<Response> {
  const config = extractLlmConfig(req)
  const targetLang = normalizeLanguageCode((new URL(req.url).searchParams.get('targetLang')) || 'ru')
  const { language, levelValue } = await req.json() as { language: string, levelValue: string }

  const normalizedLang = normalizeLanguageCode(language)

  const progress = await db.select()
    .from(schema.userQuizProgress)
    .where(and(
      eq(schema.userQuizProgress.userId, userId),
      eq(schema.userQuizProgress.language, normalizedLang),
      eq(schema.userQuizProgress.levelValue, levelValue),
    ))
    .get()

  if (!progress || !progress.unlocked) {
    throw new AppError(403, 'quiz_level_locked')
  }

  const deck = await catalogDb.select()
    .from(officialDecks)
    .where(and(
      eq(officialDecks.language, normalizedLang),
      or(
        eq(officialDecks.difficulty, levelValue),
        eq(officialDecks.title, levelValue),
      ),
    ))
    .get()

  if (!deck) {
    throw new AppError(404, `quiz_deck_not_found:${levelValue}:${normalizedLang}`)
  }

  const deckWords = await catalogDb.select()
    .from(officialDeckWords)
    .where(eq(officialDeckWords.deckId, deck.id))

  if (deckWords.length === 0) {
    throw new AppError(404, 'quiz_no_words')
  }

  // Sample words
  const wordsSample = deckWords
    .map(w => w.word)
    .sort(() => 0.5 - Math.random())
    .slice(0, 40)

  // Generate quiz via LLM
  const questions = await generateLevelQuiz(userId, normalizedLang, targetLang, levelValue, wordsSample, config)

  return json({ questions })
}

export async function handleSubmitQuiz(req: Request, userId: number): Promise<Response> {
  const { language, levelValue, score } = await req.json() as { language: string, levelValue: string, score: number }
  const normalizedLang = normalizeLanguageCode(language)

  let starsEarned = 0
  const isPassed = score >= 80

  if (isPassed) {
    if (score === 100)
      starsEarned = 3
    else if (score >= 90)
      starsEarned = 2
    else starsEarned = 1
  }

  // Get current progress
  const currentProgress = await db.select()
    .from(schema.userQuizProgress)
    .where(and(
      eq(schema.userQuizProgress.userId, userId),
      eq(schema.userQuizProgress.language, normalizedLang),
      eq(schema.userQuizProgress.levelValue, levelValue),
    ))
    .get()

  const bestScore = currentProgress ? Math.max(currentProgress.bestScore, score) : score
  const stars = currentProgress ? Math.max(currentProgress.stars, starsEarned) : starsEarned

  // Update progress
  if (currentProgress) {
    await db.update(schema.userQuizProgress)
      .set({
        bestScore,
        stars,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(schema.userQuizProgress.id, currentProgress.id))
  }
  else {
    await db.insert(schema.userQuizProgress)
      .values({
        userId,
        language: normalizedLang,
        levelValue,
        bestScore,
        stars,
        unlocked: true,
        updatedAt: new Date().toISOString(),
      })
  }

  // Unlock next level if passed
  let nextLevelUnlocked = false
  let nextLevelValue: string | null = null

  if (isPassed) {
    const levelsList = getLevelsForLanguage(normalizedLang)
    const currentIdx = levelsList.indexOf(levelValue)

    if (currentIdx !== -1 && currentIdx + 1 < levelsList.length) {
      nextLevelValue = levelsList[currentIdx + 1]

      const nextProgress = await db.select()
        .from(schema.userQuizProgress)
        .where(and(
          eq(schema.userQuizProgress.userId, userId),
          eq(schema.userQuizProgress.language, normalizedLang),
          eq(schema.userQuizProgress.levelValue, nextLevelValue),
        ))
        .get()

      if (!nextProgress) {
        await db.insert(schema.userQuizProgress)
          .values({
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
        await db.update(schema.userQuizProgress)
          .set({ unlocked: true })
          .where(eq(schema.userQuizProgress.id, nextProgress.id))
        nextLevelUnlocked = true
      }
    }
  }

  return json({
    success: true,
    score,
    starsEarned,
    isPassed,
    nextLevelUnlocked,
    nextLevelValue,
  })
}
