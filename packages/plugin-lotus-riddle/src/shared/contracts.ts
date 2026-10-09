import type { Mystery, Reply, Word } from './types'

export function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
export function normalize(value: string): string {
  return value.normalize('NFKC').toLocaleLowerCase().replace(/[\p{P}\p{S}]/gu, ' ').replace(/\s+/g, ' ').trim()
}
export function exactGuess(value: string, target: string): boolean {
  const answer = normalize(value)
  const word = normalize(target)

  return answer === word || (/^(?:a|an|the) /u.test(answer) && answer.replace(/^(?:a|an|the) /u, '') === word)
}
export function parseJson(value: unknown): unknown {
  if (typeof value !== 'string')
    return value

  try {
    return JSON.parse(value) as unknown
  }
  catch { throw new Error('AI вернул некорректный ответ. Повторите запрос.') }
}
function boundedText(value: unknown, maxLength: number): string {
  if (typeof value !== 'string' || value.length > maxLength)
    return ''

  return value.trim()
}
function parseWord(item: unknown, language: string): Word | null {
  if (!record(item) || !Number.isSafeInteger(item.id) || Number(item.id) <= 0 || item.language !== language)
    return null

  const word = boundedText(item.word, 100)
  const translation = boundedText(item.translation, 500)
  const due = boundedText(item.due, 100)

  if (!word || !translation || !due)
    return null

  return {
    id: Number(item.id),
    word,
    translation,
    language,
    due,
    transcription: boundedText(item.transcription, 150),
  }
}
export function dueWords(values: unknown[], language: string, now = Date.now()): Word[] {
  const seen = new Set<string>()

  return values.flatMap((item): Word[] => {
    const word = parseWord(item, language)

    if (!word)
      return []

    const due = Date.parse(word.due)
    const key = `${normalize(word.word)}:${normalize(word.translation)}`

    if (!Number.isFinite(due) || due > now || seen.has(key))
      return []

    seen.add(key)

    return [word]
  }).sort((a, b) => Date.parse(a.due) - Date.parse(b.due)).slice(0, 50)
}
function classificationItem(item: unknown): item is { id: number, noun: boolean, playable: boolean } {
  return record(item) && typeof item.id === 'number' && typeof item.noun === 'boolean' && typeof item.playable === 'boolean'
}
export function nounWords(value: unknown, words: Word[]): Word[] {
  const parsed = parseJson(value)

  if (!record(parsed) || !Array.isArray(parsed.items) || parsed.items.length !== words.length)
    throw new Error('AI не проверил все части речи. Повторите поиск слов.')

  const accepted = new Set<number>()
  const seen = new Set<number>()

  for (const item of parsed.items) {
    if (!classificationItem(item) || !words.some(word => word.id === item.id) || seen.has(item.id)) {
      throw new Error('AI вернул неоднозначный список существительных. Повторите поиск.')
    }

    seen.add(Number(item.id))

    if (item.noun && item.playable)
      accepted.add(Number(item.id))
  }

  return words.filter(word => accepted.has(word.id))
}
export function leaks(text: string, word: Word): boolean {
  const normalized = normalize(text)

  return [word.word, ...word.translation.split(/[;,/]/u)].some((part) => {
    const target = normalize(part)

    if (!target)
      return false

    if (/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(target))
      return normalized.includes(target)

    return ` ${normalized} `.includes(` ${target} `)
  })
}
function strings(
  value: unknown,
  min: number,
  max: number,
  length: number,
): value is string[] {
  return Array.isArray(value) && value.length >= min && value.length <= max
    && value.every(item => typeof item === 'string' && item.trim().length > 0 && item.length <= length)
}
export function parseMystery(value: unknown, word: Word): Mystery {
  const parsed = parseJson(value)

  if (!record(parsed) || typeof parsed.introduction !== 'string' || !parsed.introduction.trim()
    || parsed.introduction.length > 350 || !strings(
    parsed.facts,
    4,
    8,
    250,
  )
  || !strings(
    parsed.hints,
    3,
    3,
    200,
  )
  || [parsed.introduction, ...parsed.hints].some(text => leaks(text, word))) {
    throw new Error('Загадка получилась неполной или раскрыла слово. Создайте её ещё раз.')
  }

  return { introduction: parsed.introduction, facts: parsed.facts, hints: parsed.hints as Mystery['hints'] }
}
export function parseReply(value: unknown, kind: 'question' | 'guess'): Reply {
  const parsed = parseJson(value)
  const allowed = kind === 'question' ? ['yes', 'no', 'partial', 'unclear'] : ['no', 'almost', 'unclear']

  if (!record(parsed) || !allowed.includes(String(parsed.verdict))
    || !['closer', 'away', 'neutral'].includes(String(parsed.direction))) {
    throw new Error('Хранитель дал неоднозначный ответ. Повторите запрос.')
  }

  return { verdict: parsed.verdict as Reply['verdict'], direction: parsed.direction as Reply['direction'] }
}
