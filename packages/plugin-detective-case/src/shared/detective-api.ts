import type {
  DetectiveCase,
  ProductionEvaluation,
  SrsWord,
  WordChallenge,
} from './types'
import { getActiveApi } from './api'

const MAX_CASE_WORDS = 8
const FALLBACK_RECOGNITION_WORDS = [
  'witness',
  'suspect',
  'claim',
  'evidence',
  'notice',
  'deny',
  'report',
  'identify',
  'room',
  'key',
  'painting',
  'hotel',
]

type UnknownRecord = Record<string, unknown>

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function stringValue(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value.trim() : fallback
}

function numberValue(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function stringArray(value: unknown): string[] | null {
  if (!Array.isArray(value) || !value.every(item => typeof item === 'string')) {
    return null
  }

  return value.map(item => item.trim()).filter(Boolean)
}

function parseSrsWord(value: unknown): SrsWord | null {
  if (!isRecord(value)) {
    return null
  }

  const id = numberValue(value.id, Number.NaN)
  const word = stringValue(value.word)
  const translation = stringValue(value.translation)

  if (!Number.isInteger(id) || !word || !translation) {
    return null
  }

  const language = stringValue(value.language, 'en')
  const targetLanguage = stringValue(value.targetLanguage, 'ru')

  if (!language.toLowerCase().startsWith('en') || !targetLanguage.toLowerCase().startsWith('ru')) {
    return null
  }

  return {
    id,
    word,
    translation,
    language,
    targetLanguage,
    due: stringValue(value.due),
    reps: numberValue(value.reps),
    state: numberValue(value.state),
  }
}

function dueBucket(word: SrsWord, now: number): number {
  if (word.reps === 0) {
    return 1
  }

  const due = Date.parse(word.due)

  return !Number.isFinite(due) || due <= now ? 0 : 2
}

function dueTimestamp(word: SrsWord): number {
  const due = Date.parse(word.due)

  return Number.isFinite(due) ? due : 0
}

export function chooseCaseWords(values: unknown[], now = Date.now()): SrsWord[] {
  const words = values
    .map(parseSrsWord)
    .filter((word): word is SrsWord => word !== null)
    .sort((left, right) => {
      const leftDue = dueTimestamp(left)
      const rightDue = dueTimestamp(right)
      const leftBucket = dueBucket(left, now)
      const rightBucket = dueBucket(right, now)

      if (leftBucket !== rightBucket) {
        return leftBucket - rightBucket
      }

      return leftDue - rightDue || left.id - right.id
    })

  const seen = new Set<string>()

  return words.filter((word) => {
    const key = word.word.toLocaleLowerCase().trim()

    if (seen.has(key)) {
      return false
    }

    seen.add(key)

    return true
  }).slice(0, MAX_CASE_WORDS)
}

function parseMaybeJson(value: unknown): unknown {
  if (typeof value !== 'string') {
    return value
  }

  try {
    return JSON.parse(value) as unknown
  }
  catch {
    return null
  }
}

function hasStringField(record: UnknownRecord, field: string): boolean {
  return typeof record[field] === 'string' && record[field].trim().length > 0
}

function containsTargetWord(text: string, target: string): boolean {
  const normalizedText = text.toLocaleLowerCase().replace(/[^a-z0-9\s'-]/g, ' ').replace(/\s+/g, ' ').trim()
  const normalizedTarget = target.toLocaleLowerCase().replace(/[^a-z0-9\s'-]/g, ' ').replace(/\s+/g, ' ').trim()

  if (!normalizedText || !normalizedTarget) {
    return false
  }

  return (` ${normalizedText} `).includes(` ${normalizedTarget} `)
}

const REQUIRED_CHALLENGE_FIELDS = [
  'recognitionLine',
  'contextSentence',
  'contextAnswer',
  'recallPrompt',
  'recallAnswer',
  'productionPrompt',
  'productionExample',
  'clueTitle',
  'clueDescription',
] as const

function hasRequiredChallengeFields(value: UnknownRecord): boolean {
  return REQUIRED_CHALLENGE_FIELDS.every(field => hasStringField(value, field))
}

function isValidRecallAnswer(answer: string, target: string): boolean {
  return containsTargetWord(answer, target)
    && answer.split(/\s+/).filter(Boolean).length >= 4
}

function isValidChallengeContent(content: Pick<WordChallenge, 'recognitionLine' | 'contextSentence' | 'contextAnswer' | 'contextOptions' | 'recallAnswer' | 'acceptedRecallAnswers' | 'productionExample'>, target: string): boolean {
  const {
    recognitionLine,
    contextSentence,
    contextAnswer,
    contextOptions,
    recallAnswer,
    acceptedRecallAnswers,
    productionExample,
  } = content

  return [
    containsTargetWord(recognitionLine, target),
    contextSentence.includes('___'),
    containsTargetWord(contextAnswer, target),
    isValidRecallAnswer(recallAnswer, target),
    acceptedRecallAnswers.length > 0 && acceptedRecallAnswers.every(answer => isValidRecallAnswer(answer, target)),
    containsTargetWord(productionExample, target),
    contextOptions.some(option => option.toLocaleLowerCase() === contextAnswer.toLocaleLowerCase()),
  ].every(Boolean)
}

function parseChallenge(value: unknown, word: SrsWord): WordChallenge | null {
  if (!isRecord(value) || numberValue(value.wordId, Number.NaN) !== word.id) {
    return null
  }

  const contextOptions = stringArray(value.contextOptions)
  const acceptedRecallAnswers = stringArray(value.acceptedRecallAnswers)

  if (
    !contextOptions
    || contextOptions.length < 3
    || !acceptedRecallAnswers
    || !hasRequiredChallengeFields(value)
  ) {
    return null
  }

  const recognitionLine = stringValue(value.recognitionLine)
  const contextSentence = stringValue(value.contextSentence)
  const contextAnswer = stringValue(value.contextAnswer)
  const recallAnswer = stringValue(value.recallAnswer)
  const productionExample = stringValue(value.productionExample)

  if (!isValidChallengeContent({
    recognitionLine,
    contextSentence,
    contextAnswer,
    contextOptions,
    recallAnswer,
    acceptedRecallAnswers,
    productionExample,
  }, word.word)) {
    return null
  }

  return {
    wordId: word.id,
    recognitionLine,
    contextSentence,
    contextAnswer,
    contextOptions,
    recallPrompt: stringValue(value.recallPrompt),
    recallAnswer,
    acceptedRecallAnswers,
    productionPrompt: stringValue(value.productionPrompt),
    productionExample,
    clueTitle: stringValue(value.clueTitle),
    clueDescription: stringValue(value.clueDescription),
  }
}

function parseDetectiveCase(value: unknown, words: SrsWord[]): DetectiveCase | null {
  const parsed = parseMaybeJson(value)

  if (!isRecord(parsed)) {
    return null
  }

  const suspectsValue = parsed.suspects

  if (!Array.isArray(suspectsValue) || suspectsValue.length < 3) {
    return null
  }

  const suspects = suspectsValue.flatMap((suspect) => {
    if (!isRecord(suspect) || !hasStringField(suspect, 'id') || !hasStringField(suspect, 'name') || !hasStringField(suspect, 'role') || !hasStringField(suspect, 'statement')) {
      return []
    }

    return [{
      id: stringValue(suspect.id),
      name: stringValue(suspect.name),
      role: stringValue(suspect.role),
      statement: stringValue(suspect.statement),
    }]
  })

  if (suspects.length < 3 || new Set(suspects.map(suspect => suspect.id)).size !== suspects.length) {
    return null
  }

  const culpritId = stringValue(parsed.culpritId)

  if (!suspects.some(suspect => suspect.id === culpritId)) {
    return null
  }

  const challengeValues = parsed.challenges

  if (!Array.isArray(challengeValues)) {
    return null
  }

  const challenges = words.flatMap((word) => {
    const valueForWord = challengeValues.find(item => isRecord(item) && numberValue(item.wordId, Number.NaN) === word.id)
    const challenge = parseChallenge(valueForWord, word)

    return challenge ? [challenge] : []
  })

  if (challenges.length !== words.length) {
    return null
  }

  return {
    title: stringValue(parsed.title, 'The Missing Painting'),
    opening: stringValue(parsed.opening),
    suspects,
    culpritId,
    reveal: stringValue(parsed.reveal),
    challenges,
  }
}

function buildCaseSystemPrompt(): string {
  return [
    'You are a careful English-language mystery writer and language-teaching exercise designer.',
    'Create one fair, solvable hotel-painting theft mystery for a Russian-speaking English learner.',
    'The target vocabulary is supplied by the user. Every target word must appear exactly as written in recognitionLine, contextAnswer, recallAnswer, and productionExample.',
    'Keep all clues consistent with one culprit. The culprit must be inferable from statements and clue descriptions, not from arbitrary hidden information.',
    'Write UI prompts, clue titles, clue descriptions, and suspect roles in Russian. Write dialogue, sentences, and expected answers in natural English.',
    'Return only a JSON object matching the requested fields. Do not use markdown.',
    'For each target word make four contextOptions, including contextAnswer. contextSentence must contain exactly one blank marker: ___. contextAnswer must use the exact target spelling.',
    'Each recallPrompt should ask what a witness or suspect said about one fact. Ask the learner to reconstruct the full sentence in English. recallAnswer, every acceptedRecallAnswers item, and productionExample must be full natural sentences containing the exact target word, never only the target word.',
    'Use concise text. Do not introduce unsupported crime-scene facts or change the culprit between fields.',
  ].join('\n')
}

function buildCasePrompt(words: SrsWord[]): string {
  const input = {
    premise: 'A valuable painting disappeared from a hotel gallery shortly before the guests left.',
    vocabulary: words.map(word => ({
      wordId: word.id,
      word: word.word,
      meaning: word.translation,
    })),
    outputShape: {
      title: 'Short English title',
      opening: '2-3 Russian sentences introducing the hotel and the missing painting',
      suspects: [
        { id: 'unique-id', name: 'Name', role: 'Russian role', statement: 'One short English statement' },
      ],
      culpritId: 'one suspect id',
      reveal: 'Russian explanation connecting at least two clues to the culprit',
      challenges: [
        {
          wordId: 0,
          recognitionLine: 'English dialogue sentence containing the exact target word',
          contextSentence: 'English sentence with ___',
          contextAnswer: 'exact target spelling',
          contextOptions: ['four short choices'],
          recallPrompt: 'Russian question asking the learner to reconstruct a complete statement',
          recallAnswer: 'Complete English sentence containing the exact target word',
          acceptedRecallAnswers: ['one complete natural sentence', 'one complete sentence variant'],
          productionPrompt: 'Russian instruction asking for one original English sentence with the exact target word',
          productionExample: 'Natural English sample sentence with exact target word',
          clueTitle: 'Russian clue title',
          clueDescription: 'Russian clue description that helps solve the mystery',
        },
      ],
    },
    constraints: [
      'Create 3 or 4 suspects and exactly one culprit.',
      'Create exactly one challenge per vocabulary item, preserving every wordId.',
      'Keep every challenge tied to the painting theft and the same hotel case.',
      'Use the supplied word forms exactly in all required English fields and accepted recall sentences.',
    ],
  }

  return JSON.stringify(input)
}

export async function generateDetectiveCase(words: SrsWord[]): Promise<DetectiveCase> {
  const api = getActiveApi()
  const result = await api.llm.generate<unknown>({
    action: 'detective_case_generate',
    systemPrompt: buildCaseSystemPrompt(),
    prompt: buildCasePrompt(words),
    json: true,
    temperature: 0.35,
  })

  if (!result.success) {
    throw new Error('LLM не смог подготовить дело. Попробуйте создать его ещё раз.')
  }

  const gameCase = parseDetectiveCase(result.data ?? result.text, words)

  if (!gameCase) {
    throw new Error('LLM вернул неполное дело. Попробуйте создать его ещё раз.')
  }

  return gameCase
}

export function createRecognitionOptions(challenge: WordChallenge, words: SrsWord[]): string[] {
  const target = words.find(word => word.id === challenge.wordId)

  if (!target) {
    return []
  }

  const distractors = [...words.map(word => word.word), ...FALLBACK_RECOGNITION_WORDS]
    .filter((word, index, all) => word.toLocaleLowerCase() !== target.word.toLocaleLowerCase()
      && all.findIndex(item => item.toLocaleLowerCase() === word.toLocaleLowerCase()) === index)
    .slice(0, 3)
  const choices = [target.word, ...distractors]

  return choices.sort((left, right) => {
    const leftHash = (`${challenge.wordId}:${left}`).split('').reduce((sum, char) => sum + char.charCodeAt(0), 0)
    const rightHash = (`${challenge.wordId}:${right}`).split('').reduce((sum, char) => sum + char.charCodeAt(0), 0)

    return leftHash - rightHash
  })
}

function normalizeAnswer(value: string): string {
  return value.toLocaleLowerCase().replace(/[^\p{L}\p{N}\s'-]/gu, ' ').replace(/\s+/g, ' ').trim()
}

function containsTargetToken(value: string, target: string): boolean {
  const answerTokens = normalizeAnswer(value).split(' ')
  const targetTokens = normalizeAnswer(target).split(' ')

  if (!targetTokens.length || targetTokens.some(token => !token)) {
    return false
  }

  if (targetTokens.length === 1) {
    return answerTokens.includes(targetTokens[0])
      || answerTokens.some(token => token.startsWith(targetTokens[0]) && token.length <= targetTokens[0].length + 4)
  }

  const answer = ` ${answerTokens.join(' ')} `

  return answer.includes(` ${targetTokens.join(' ')} `)
}

export function matchesRecallAnswer(answer: string, challenge: WordChallenge, word: SrsWord): boolean {
  const normalizedAnswer = normalizeAnswer(answer)
  const matchesAcceptedSentence = challenge.acceptedRecallAnswers.some((accepted) => {
    const normalizedAccepted = normalizeAnswer(accepted)

    return normalizedAccepted.length > 0 && normalizedAnswer === normalizedAccepted
  })

  if (matchesAcceptedSentence) {
    return true
  }

  return normalizedAnswer.split(' ').filter(Boolean).length >= 4
    && containsTargetToken(answer, word.word)
}

export async function evaluateProduction(
  answer: string,
  challenge: WordChallenge,
  word: SrsWord,
  gameCase: DetectiveCase,
): Promise<ProductionEvaluation> {
  const api = getActiveApi()
  const systemPrompt = [
    'You are an encouraging but accurate English sentence evaluator for a vocabulary detective game.',
    'Accept natural English sentences that use the target vocabulary item correctly. Accept small grammar or spelling errors only when meaning is still clear, and explain the correction.',
    'Reject empty, unrelated, copied prompt text, or answers that do not use the target word or a natural inflection of it.',
    'The case facts are context only; do not invent new case details.',
    'Return only JSON: {"accepted": boolean, "score": number from 0 to 1, "feedback": "short Russian explanation", "correctedAnswer": "corrected English sentence"}.',
  ].join('\n')
  const prompt = JSON.stringify({
    targetWord: word.word,
    meaning: word.translation,
    task: challenge.productionPrompt,
    sampleAnswer: challenge.productionExample,
    caseTitle: gameCase.title,
    userAnswer: answer,
  })

  try {
    const result = await api.llm.generate<unknown>({
      action: 'detective_answer_grade',
      systemPrompt,
      prompt,
      json: true,
      temperature: 0.1,
    })
    const parsed = parseMaybeJson(result.data ?? result.text)

    if (result.success && isRecord(parsed) && typeof parsed.accepted === 'boolean') {
      return {
        accepted: parsed.accepted,
        score: Math.max(0, Math.min(1, numberValue(parsed.score))),
        feedback: stringValue(parsed.feedback, parsed.accepted ? 'Хорошая фраза.' : 'Попробуйте ещё раз и используйте целевое слово.'),
        correctedAnswer: stringValue(parsed.correctedAnswer, challenge.productionExample),
      }
    }
  }
  catch {
    // The lightweight fallback below keeps the practice usable during a temporary LLM outage.
  }

  const hasTarget = containsTargetToken(answer, word.word)
  const hasSentenceLength = normalizeAnswer(answer).split(' ').filter(Boolean).length >= 3
  const accepted = hasTarget && hasSentenceLength

  return {
    accepted,
    score: accepted ? 0.65 : 0.1,
    feedback: accepted
      ? 'Проверка связности временно недоступна. Целевое слово найдено — фразу засчитали.'
      : `Проверка связности временно недоступна. Составьте фразу из нескольких слов и включите "${word.word}".`,
    correctedAnswer: challenge.productionExample,
  }
}
