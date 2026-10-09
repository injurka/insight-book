import type {
  DetectiveCase,
  LearningStage,
  ProductionEvaluation,
  SrsWord,
} from '@/shared/types'
import { computed, reactive } from 'vue'
import { getActiveApi } from '@/shared/api'
import {
  chooseCaseWords,
  createRecognitionOptions,
  evaluateProduction,
  generateDetectiveCase,
  matchesRecallAnswer,
} from '@/shared/detective-api'

export type GameScreen = 'home' | 'playing' | 'accusation' | 'complete'

export interface GameFeedback {
  correct: boolean
  message: string
  correctedAnswer?: string
}

const LEARNING_STAGES: LearningStage[] = [
  'recognition',
  'meaning',
  'context',
  'recall',
  'production',
]

function normalizeAnswer(value: string): string {
  return value.toLocaleLowerCase().replace(/[^\p{L}\p{N}\s'-]/gu, ' ').replace(/\s+/g, ' ').trim()
}

function isMeaningAccepted(answer: string, translation: string): boolean {
  const normalizedAnswer = normalizeAnswer(answer)

  if (!normalizedAnswer) {
    return false
  }

  return translation.split(/[;,|]/)
    .map(value => normalizeAnswer(value))
    .filter(Boolean)
    .includes(normalizedAnswer)
}

export function useDetectiveGame() {
  const state = reactive({
    screen: 'home' as GameScreen,
    words: [] as SrsWord[],
    reviewQueueCount: 0,
    gameCase: null as DetectiveCase | null,
    current: {
      wordIndex: 0,
      stageIndex: 0,
    },
    progress: {
      mistakesByWord: {} as Record<number, number>,
      productionScoreByWord: {} as Record<number, number>,
      completedWordIds: [] as number[],
      accusationAttempts: 0,
    },
    request: {
      isLoadingWords: false,
      isGeneratingCase: false,
      isCheckingProduction: false,
      isSavingGrade: false,
      error: '',
      srsError: '',
    },
    response: {
      feedback: null as GameFeedback | null,
      accusationFeedback: '',
    },
    accusedSuspectId: '',
  })

  const currentWord = computed(() => state.words[state.current.wordIndex] ?? null)
  const currentChallenge = computed(() => {
    if (!state.gameCase || !currentWord.value) {
      return null
    }

    return state.gameCase.challenges.find(challenge => challenge.wordId === currentWord.value?.id) ?? null
  })
  const currentStage = computed(() => LEARNING_STAGES[state.current.stageIndex] ?? 'recognition')
  const recognitionOptions = computed(() => {
    if (!currentChallenge.value) {
      return []
    }

    return createRecognitionOptions(currentChallenge.value, state.words)
  })
  const currentClue = computed(() => currentChallenge.value
    ? { title: currentChallenge.value.clueTitle, description: currentChallenge.value.clueDescription }
    : null)
  const completedClues = computed(() => {
    if (!state.gameCase) {
      return []
    }

    return state.gameCase.challenges
      .filter(challenge => state.progress.completedWordIds.includes(challenge.wordId))
      .map(challenge => ({ wordId: challenge.wordId, title: challenge.clueTitle, description: challenge.clueDescription }))
  })
  const stageNumber = computed(() => state.current.stageIndex + 1)
  const progressPercent = computed(() => {
    const total = state.words.length * LEARNING_STAGES.length
    const completed = state.progress.completedWordIds.length * LEARNING_STAGES.length + state.current.stageIndex

    return total > 0 ? Math.min(100, Math.round((completed / total) * 100)) : 0
  })
  const dueCount = computed(() => state.reviewQueueCount)

  async function loadWords(): Promise<void> {
    state.request.isLoadingWords = true
    state.request.error = ''

    try {
      const values = await getActiveApi().dictionary.getDueWords('en')
      state.words = chooseCaseWords(values)
      state.reviewQueueCount = values.length
    }
    catch (error: unknown) {
      state.request.error = error instanceof Error ? error.message : 'Не удалось загрузить слова из SRS.'
      state.words = []
      state.reviewQueueCount = 0
    }
    finally {
      state.request.isLoadingWords = false
    }
  }

  async function startCase(): Promise<void> {
    if (state.words.length === 0) {
      await loadWords()
    }

    if (state.words.length === 0) {
      state.request.error = 'В словаре пока нет английских слов с переводом на русский.'

      return
    }

    state.request.isGeneratingCase = true
    state.request.error = ''

    try {
      state.gameCase = await generateDetectiveCase(state.words)
      state.current.wordIndex = 0
      state.current.stageIndex = 0
      state.progress.mistakesByWord = {}
      state.progress.productionScoreByWord = {}
      state.progress.completedWordIds = []
      state.progress.accusationAttempts = 0
      state.response.feedback = null
      state.response.accusationFeedback = ''
      state.request.srsError = ''
      state.accusedSuspectId = ''
      state.screen = 'playing'
    }
    catch (error: unknown) {
      state.request.error = error instanceof Error ? error.message : 'Не удалось подготовить дело.'
    }
    finally {
      state.request.isGeneratingCase = false
    }
  }

  function clearFeedback(): void {
    state.response.feedback = null
  }

  function markIncorrect(message: string): void {
    if (currentWord.value) {
      const wordId = currentWord.value.id
      state.progress.mistakesByWord[wordId] = (state.progress.mistakesByWord[wordId] ?? 0) + 1
    }

    state.response.feedback = { correct: false, message }
  }

  function markCorrect(message: string): void {
    state.response.feedback = { correct: true, message }
  }

  function submitRecognition(selectedWord: string): void {
    clearFeedback()

    if (!currentWord.value) {
      return
    }

    if (selectedWord.toLocaleLowerCase() === currentWord.value.word.toLocaleLowerCase()) {
      markCorrect('Верно. Это слово прозвучало в реплике.')
    }
    else {
      markIncorrect('В этой реплике было другое слово. Прочитайте её ещё раз.')
    }
  }

  function submitMeaning(answer: string): void {
    clearFeedback()

    if (!currentWord.value) {
      return
    }

    if (isMeaningAccepted(answer, currentWord.value.translation)) {
      markCorrect('Да, значение подходит.')
    }
    else {
      markIncorrect('Проверьте значение слова и попробуйте ещё раз.')
    }
  }

  function submitContext(selectedAnswer: string): void {
    clearFeedback()

    if (!currentChallenge.value) {
      return
    }

    if (selectedAnswer.toLocaleLowerCase() === currentChallenge.value.contextAnswer.toLocaleLowerCase()) {
      markCorrect('Подходит по смыслу и по контексту.')
    }
    else {
      markIncorrect('Посмотрите на подсказки в предложении и выберите другой вариант.')
    }
  }

  function submitRecall(answer: string): void {
    clearFeedback()

    if (!currentWord.value || !currentChallenge.value) {
      return
    }

    if (matchesRecallAnswer(answer, currentChallenge.value, currentWord.value)) {
      markCorrect('Вы восстановили показание целиком.')
    }
    else {
      markIncorrect('Вспомните показание целиком и ответьте полным предложением.')
    }
  }

  async function submitProduction(answer: string): Promise<void> {
    if (!currentWord.value || !currentChallenge.value || !state.gameCase) {
      return
    }

    clearFeedback()
    state.request.isCheckingProduction = true

    try {
      const evaluation: ProductionEvaluation = await evaluateProduction(
        answer,
        currentChallenge.value,
        currentWord.value,
        state.gameCase,
      )

      if (evaluation.accepted) {
        state.progress.productionScoreByWord[currentWord.value.id] = evaluation.score
        state.response.feedback = {
          correct: true,
          message: evaluation.feedback,
          correctedAnswer: evaluation.correctedAnswer,
        }
      }
      else {
        markIncorrect(evaluation.feedback)
        state.response.feedback = {
          correct: false,
          message: evaluation.feedback,
          correctedAnswer: evaluation.correctedAnswer,
        }
      }
    }
    catch (error: unknown) {
      markIncorrect(error instanceof Error ? error.message : 'Не удалось проверить фразу.')
    }
    finally {
      state.request.isCheckingProduction = false
    }
  }

  function gradeForCurrentWord(wordId: number): number {
    const mistakes = state.progress.mistakesByWord[wordId] ?? 0
    const productionScore = state.progress.productionScoreByWord[wordId] ?? 0

    if (mistakes >= 4) {
      return 1
    }

    if (mistakes > 0 || productionScore < 0.8) {
      return 2
    }

    if (productionScore >= 0.95) {
      return 4
    }

    return 3
  }

  async function advance(): Promise<void> {
    if (!state.response.feedback?.correct || state.request.isSavingGrade) {
      return
    }

    state.response.feedback = null

    if (state.current.stageIndex < LEARNING_STAGES.length - 1) {
      state.current.stageIndex += 1

      return
    }

    const word = currentWord.value

    if (!word) {
      return
    }

    state.request.isSavingGrade = true

    try {
      await getActiveApi().dictionary.submitGrade(word.id, gradeForCurrentWord(word.id))
      state.progress.completedWordIds.push(word.id)
    }
    catch {
      state.request.srsError = 'Не удалось сохранить оценку одного из слов в SRS. Дело можно продолжить.'
      state.progress.completedWordIds.push(word.id)
    }
    finally {
      state.request.isSavingGrade = false
    }

    if (state.current.wordIndex >= state.words.length - 1) {
      state.screen = 'accusation'

      return
    }

    state.current.wordIndex += 1
    state.current.stageIndex = 0
  }

  function accuse(suspectId: string): void {
    if (!state.gameCase) {
      return
    }

    state.accusedSuspectId = suspectId
    state.progress.accusationAttempts += 1

    if (suspectId === state.gameCase.culpritId) {
      state.response.accusationFeedback = 'Вы раскрыли дело.'
      state.screen = 'complete'
    }
    else {
      state.response.accusationFeedback = 'Это не сходится с уликами. Пересмотрите записи и попробуйте ещё раз.'
    }
  }

  function returnHome(): void {
    state.screen = 'home'
    state.gameCase = null
    state.current.wordIndex = 0
    state.current.stageIndex = 0
    state.response.feedback = null
    state.accusedSuspectId = ''
  }

  return {
    state,
    currentWord,
    currentChallenge,
    currentStage,
    recognitionOptions,
    currentClue,
    completedClues,
    stageNumber,
    progressPercent,
    dueCount,
    loadWords,
    startCase,
    submitRecognition,
    submitMeaning,
    submitContext,
    submitRecall,
    submitProduction,
    advance,
    accuse,
    returnHome,
  }
}
