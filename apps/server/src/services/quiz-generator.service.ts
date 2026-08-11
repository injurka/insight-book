import type { DeepDiveQuizResponse, LlmConfig, ModelMessage, QuizQuestion } from '../types'
import { ERROR_CODES } from '../constants/error-codes'
import { getDeepDivePrompt, getLangName, getQuizGenerationPrompt } from '../prompts'
import { AppError } from '../utils/errors'
import { parseLlmJson } from '../utils/helpers'
import { callLlmJsonWithRetry } from '../utils/llm-api'
import { logger } from '../utils/logger'
import { checkTokenLimit } from './limits.service'
import { trackTokenUsage } from './token.service'

export async function generateDeepDiveQuiz(userId: number, word: string, language: string, targetLang: string, mode: 'collocations' | 'radicals', config: LlmConfig): Promise<DeepDiveQuizResponse> {
  await checkTokenLimit(userId)
  if (!config.url)
    throw new AppError(500, ERROR_CODES.SYSTEM.LLM_NOT_CONFIGURED, 'LLM API not configured')

  const messages: ModelMessage[] = [
    { role: 'system', content: getDeepDivePrompt(language, targetLang, mode) },
    { role: 'user', content: `Word: ${word}` },
  ]

  const modelsToTry = [config.model, config.fallbackModel].filter(Boolean) as string[]
  let lastError: Error | null = null

  for (const model of modelsToTry) {
    try {
      const { parsed } = await callLlmJsonWithRetry<DeepDiveQuizResponse>(
        model,
        messages,
        0.4,
        AbortSignal.timeout(60000),
        config,
        raw => parseLlmJson<DeepDiveQuizResponse>(raw),
        (usage, rawText, messagesUsed) => {
          trackTokenUsage(userId, `deep_dive_${mode}`, model, usage.promptTokens, usage.completionTokens, JSON.stringify(messagesUsed, null, 2), rawText)
        },
      )
      return parsed
    }
    catch (e) {
      lastError = e as Error
      logger.warn({ err: lastError }, `[LLM] Failed with model [${model}]:`)
    }
  }

  throw new AppError(500, ERROR_CODES.QUIZ.GENERATION_FAILED, `Quiz generation failed: ${lastError?.message || 'Unknown error'}`)
}

function reconstructReorderOptions(questions: QuizQuestion[], language: string): QuizQuestion[] {
  const isCJK = ['zh', 'ja'].includes(language)
  return questions.map((q) => {
    if (q.type === 'reorder') {
      q.correctAnswer = q.correctAnswer?.toLowerCase().trim() || ''

      q.acceptableAnswers = Array.isArray(q.acceptableAnswers)
        ? q.acceptableAnswers.map((a: string) => a.toLowerCase().trim())
        : []

      if (!q.acceptableAnswers.includes(q.correctAnswer)) {
        q.acceptableAnswers.unshift(q.correctAnswer)
      }

      if (!isCJK && q.correctAnswer) {
        const answerWords = q.correctAnswer
          .replace(/[.,!?;:()¿¡"']/g, '')
          .split(/\s+/)
          .filter(Boolean)

        if (answerWords.length > 0) {
          const answerWordsLower = answerWords.map((w: string) => w.toLowerCase())
          const originalOptionsLower = (q.options || []).map((o: string) => String(o).toLowerCase())

          const distractors = originalOptionsLower.filter((opt: string) => {
            const idx = answerWordsLower.indexOf(opt)
            if (idx !== -1) {
              answerWordsLower.splice(idx, 1)
              return false
            }
            return true
          })

          const cleanAnswerWords = q.correctAnswer.replace(/[.,!?;:()¿¡"']/g, '').split(/\s+/).filter(Boolean).map((w: string) => w.toLowerCase())
          const allOptions = [...cleanAnswerWords, ...distractors]
          q.options = allOptions.sort(() => Math.random() - 0.5)
        }
      }
      else {
        q.options = (q.options || []).map((o: string) => String(o).toLowerCase()).sort(() => Math.random() - 0.5)
      }
    }
    return q
  })
}

function validateQuizQuestions(questions: QuizQuestion[]): string | null {
  if (!Array.isArray(questions))
    return 'Quiz is not a valid JSON array'
  if (questions.length < 10)
    return `Quiz array length ${questions.length} is too short, must be at least 10 questions`

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i]
    if (!q.type || !['choice', 'cloze', 'reorder'].includes(q.type)) {
      return `Question ${i + 1} has invalid type: ${q?.type}`
    }
    if (!q.question || typeof q.question !== 'string') {
      return `Question ${i + 1} is missing a text question query`
    }
    if (!q.options || !Array.isArray(q.options) || q.options.length === 0) {
      return `Question ${i + 1} is missing options array`
    }
    if (!q.correctAnswer || typeof q.correctAnswer !== 'string') {
      return `Question ${i + 1} is missing correctAnswer`
    }
    if (!q.explanation || typeof q.explanation !== 'string') {
      return `Question ${i + 1} is missing explanation`
    }

    if (q.type === 'reorder') {
      if (q.question.trim().toLowerCase() === q.correctAnswer.trim().toLowerCase()) {
        return `Question ${i + 1} of type 'reorder' must contain the TRANSLATION of the sentence, not the sentence itself.`
      }
      if (!Array.isArray(q.acceptableAnswers) || q.acceptableAnswers.length === 0) {
        return `Question ${i + 1} of type 'reorder' is missing 'acceptableAnswers' array.`
      }
      if (!q.acceptableAnswers.includes(q.correctAnswer)) {
        return `Question ${i + 1}: 'acceptableAnswers' must include the 'correctAnswer'.`
      }
    }

    if (q.type === 'choice' || q.type === 'cloze') {
      if (!q.options.includes(q.correctAnswer)) {
        return `Question ${i + 1} correctAnswer "${q.correctAnswer}" is not present in options list [${q.options.join(', ')}]`
      }
    }
  }
  return null
}

export async function generateLevelQuiz(
  userId: number,
  language: string,
  targetLang: string,
  levelValue: string,
  words: string[],
  config: LlmConfig,
): Promise<QuizQuestion[]> {
  await checkTokenLimit(userId)
  if (!config.url)
    throw new AppError(500, ERROR_CODES.SYSTEM.LLM_NOT_CONFIGURED, 'LLM API not configured')

  const prompt = getQuizGenerationPrompt(language, targetLang, levelValue)

  const messages: ModelMessage[] = [
    { role: 'system', content: prompt },
    { role: 'user', content: `Generate a quiz using a selection from these words: ${words.join(', ')}` },
  ]

  const modelsToTry = [config.model, config.fallbackModel].filter(Boolean) as string[]
  let lastError: Error | null = null

  for (const model of modelsToTry) {
    try {
      const { parsed } = await callLlmJsonWithRetry<QuizQuestion[]>(
        model,
        messages,
        0.5,
        AbortSignal.timeout(90000),
        config,
        raw => parseLlmJson<QuizQuestion[]>(raw),
        (usage, rawText, messagesUsed) => {
          trackTokenUsage(userId, `generate_quiz`, model, usage.promptTokens, usage.completionTokens, JSON.stringify(messagesUsed, null, 2), rawText)
        },
      )

      if (Array.isArray(parsed) && parsed.length > 0) {
        let validQuiz = parsed
        const validationError = validateQuizQuestions(parsed)
        if (validationError) {
          logger.warn(`[Quiz critic] Validation failed: ${validationError}. Requesting correction...`)

          const correctionMessages: ModelMessage[] = [
            ...messages,
            { role: 'assistant', content: JSON.stringify(parsed) },
            { role: 'user', content: `CRITICAL ERROR in your generated quiz: ${validationError}. Please fix the errors and output the corrected full JSON array of questions.` },
          ]

          const corrected = await callLlmJsonWithRetry<QuizQuestion[]>(
            model,
            correctionMessages,
            0.2,
            AbortSignal.timeout(90000),
            config,
            raw => parseLlmJson<QuizQuestion[]>(raw),
            (usage, rawText, messagesUsed) => {
              trackTokenUsage(userId, `generate_quiz`, model, usage.promptTokens, usage.completionTokens, JSON.stringify(messagesUsed, null, 2), rawText)
            },
          )

          const finalError = validateQuizQuestions(corrected.parsed)
          if (!finalError) {
            validQuiz = corrected.parsed
          }
          else {
            logger.warn(`[Quiz critic] Correction also failed: ${finalError}. Proceeding with original.`)
          }
        }

        const srcLangName = getLangName(language)
        const targetLangName = getLangName(targetLang)

        const reviewerMessages: ModelMessage[] = [
          {
            role: 'system',
            content: `You are an expert ${srcLangName} linguist and test reviewer for the ${levelValue} level. 
Your task is to review the provided JSON quiz.
1. Fix any grammatical or logical errors in the questions, options, or explanations.
2. Ensure that the vocabulary and grammar strictly adhere to the ${levelValue} level. Simplify overly complex sentences or words.
3. Ensure the 'correctAnswer' perfectly solves the question and is mathematically/logically sound.
4. For 'reorder' questions, YOU MUST ENSURE the translation perfectly matches the 'correctAnswer' and NO WORDS ARE DROPPED (e.g., if there's 'now' or 'initially', it must be translated).
5. For 'reorder' questions, you MUST brainstorm and add ALL possible valid word orders to the 'acceptableAnswers' array to prevent failing students for alternative valid wordings.
6. For 'reorder' questions, DO NOT remove extra distractor words from the 'options' array. Distractors are intentional and MUST be kept! Ensure all words in 'acceptableAnswers' can be built from 'options'.
7. CRITICAL: The "question" field for "choice" and "reorder" types MUST remain strictly in the student's native language (${targetLangName}). Do NOT translate these question texts to ${srcLangName}.
8. To prevent capitalization hints, make sure all 'options', 'correctAnswer', and 'acceptableAnswers' are entirely lowercase.
9. For 'cloze' questions, verify that ONLY the 'correctAnswer' fits the blank. If any distractor in the 'options' can also grammatically and logically fit the blank (e.g., both "меня" and "её" for "___ зовут Анна"), REPLACE that distractor with an unequivocally incorrect word so there is NO ambiguity.
10. If the quiz is mostly good, just return the improved JSON array of questions with your fixes applied.
Output MUST be a valid JSON array of question objects, exactly matching the schema. No markdown formatting outside of JSON.`,
          },
          { role: 'user', content: JSON.stringify(validQuiz) },
        ]

        try {
          const reviewed = await callLlmJsonWithRetry<QuizQuestion[]>(
            model,
            reviewerMessages,
            0.3,
            AbortSignal.timeout(90000),
            config,
            raw => parseLlmJson<QuizQuestion[]>(raw),
            (usage, rawText, messagesUsed) => {
              trackTokenUsage(userId, `generate_quiz`, model, usage.promptTokens, usage.completionTokens, JSON.stringify(messagesUsed, null, 2), rawText)
            },
          )

          const reviewError = validateQuizQuestions(reviewed.parsed)
          if (!reviewError && Array.isArray(reviewed.parsed) && reviewed.parsed.length > 0) {
            return reconstructReorderOptions(reviewed.parsed, language)
          }
          logger.warn(`[Quiz Reviewer] Semantic correction broke schema: ${reviewError}. Returning original technically valid quiz.`)
          return reconstructReorderOptions(validQuiz, language)
        }
        catch (revError) {
          logger.warn(revError, `[Quiz Reviewer] LLM reviewer failed. Returning original technically valid quiz.`)
          return reconstructReorderOptions(validQuiz, language)
        }
      }
      throw new Error('LLM did not return a valid quiz array')
    }
    catch (e) {
      lastError = e as Error
      logger.warn({ err: lastError }, `[LLM Quiz Generation] Failed with model [${model}]:`)
    }
  }

  throw new AppError(500, ERROR_CODES.QUIZ.GENERATION_FAILED, `Quiz generation failed: ${lastError?.message || 'Unknown error'}`)
}
