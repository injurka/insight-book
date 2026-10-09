import type { Round, Turn } from './types'
import { dueWords, parseMystery, record } from './contracts'
import { MAX_TURNS } from './types'

interface Snapshot { language: string, round: Round | null, used: number[], savedAt: number }
function validProgress(value: Record<string, unknown>): boolean {
  return Number.isInteger(value.hintsUsed) && Number(value.hintsUsed) >= 0 && Number(value.hintsUsed) <= 3
    && ['playing', 'solved', 'revealed', 'exhausted'].includes(String(value.outcome))
    && ['idle', 'sending', 'saved', 'uncertain', 'skipped'].includes(String(value.grade))
}
function parseTurn(turn: unknown): Turn | null {
  if (!record(turn) || typeof turn.text !== 'string' || turn.text.length > 300
    || !['question', 'guess'].includes(String(turn.kind))
    || !['yes', 'no', 'partial', 'unclear', 'almost', 'solved'].includes(String(turn.verdict))
    || !['closer', 'away', 'neutral'].includes(String(turn.direction))) {
    return null
  }

  return turn as unknown as Turn
}
function parseRound(value: unknown): Round | null {
  if (!record(value) || !record(value.word) || typeof value.word.language !== 'string' || !validProgress(value))
    return null

  const word = dueWords([value.word], value.word.language, Number.POSITIVE_INFINITY)[0]

  if (!word || !Array.isArray(value.turns) || value.turns.length > MAX_TURNS)
    return null

  const turns = value.turns.map(parseTurn)

  if (turns.some(turn => !turn))
    return null

  return {
    word,
    mystery: parseMystery(value.mystery, word),
    turns: turns as Turn[],
    hintsUsed: Number(value.hintsUsed),
    outcome: value.outcome as Round['outcome'],
    grade: value.grade === 'sending' ? 'uncertain' : value.grade as Round['grade'],
  }
}
export function sessionKey(profile: unknown): string | null {
  if (!record(profile) || !['number', 'string'].includes(typeof profile.id))
    return null

  return `lotus-riddle:v1:${encodeURIComponent(String(profile.id))}`
}
function validSnapshot(raw: unknown): raw is Snapshot {
  if (!record(raw) || typeof raw.language !== 'string' || typeof raw.savedAt !== 'number')
    return false

  if (Date.now() - raw.savedAt > 12 * 60 * 60 * 1000 || raw.savedAt > Date.now() || !Array.isArray(raw.used))
    return false

  return raw.used.length <= 500 && raw.used.every(id => Number.isSafeInteger(id) && id > 0)
}
export function loadSession(key: string | null): Snapshot | null {
  if (!key)
    return null

  try {
    const raw: unknown = JSON.parse(sessionStorage.getItem(key) ?? 'null')

    if (!validSnapshot(raw))
      return null

    const round = raw.round === null ? null : parseRound(raw.round)

    if (raw.round !== null && !round)
      return null

    return { language: raw.language, round, used: raw.used, savedAt: raw.savedAt }
  }
  catch { return null }
}
export function saveSession(key: string | null, snapshot: Omit<Snapshot, 'savedAt'>): boolean {
  if (!key)
    return false

  try {
    sessionStorage.setItem(key, JSON.stringify({ ...snapshot, savedAt: Date.now() }))

    return true
  }
  catch { return false }
}
