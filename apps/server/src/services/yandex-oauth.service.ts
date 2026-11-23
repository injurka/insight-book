import type { OAuthLocale } from '../views/oauth-result'
import type { AuthSessionService } from './auth-session.service'
import { ERROR_CODES } from '../constants/error-codes'
import { AppError } from '../utils/errors'

export interface OAuthAttempt {
  sessionId: string
  mode: 'web' | 'desktop' | 'legacy'
  locale: OAuthLocale
  linkUserId?: number
}

export type OAuthStatus = { status: 'success' } & (Awaited<ReturnType<AuthSessionService['create']>> | { token: string } | { linked: true })
  | { status: 'error', error: 'cancelled' | 'failed' | 'account_conflict' }

const OAUTH_TTL_MS = 10 * 60_000
const MAX_ATTEMPTS = 5_000
const attempts = new Map<string, { value: OAuthAttempt, expiresAt: number }>()
const results = new Map<string, { value: OAuthStatus, expiresAt: number }>()

const activeSessions = new Set<string>()

function prune(now: number) {
  for (const [state, attempt] of attempts) {
    if (attempt.expiresAt <= now) {
      activeSessions.delete(attempt.value.sessionId)
      attempts.delete(state)
    }
  }

  for (const [sessionId, result] of results) {
    if (result.expiresAt <= now)
      results.delete(sessionId)
  }
}

export function startOAuthAttempt(attempt: OAuthAttempt): string {
  const now = Date.now()
  prune(now)

  if (activeSessions.has(attempt.sessionId) || results.has(attempt.sessionId))
    throw new AppError(409, ERROR_CODES.SYSTEM.VALIDATION_ERROR, 'OAuth attempt already exists')

  if (activeSessions.size + results.size >= MAX_ATTEMPTS)
    throw new AppError(429, ERROR_CODES.SYSTEM.RATE_LIMIT_EXCEEDED, 'Too many OAuth attempts')

  const state = crypto.randomUUID()
  activeSessions.add(attempt.sessionId)
  attempts.set(state, { value: attempt, expiresAt: now + OAUTH_TTL_MS })

  return state
}

export function takeOAuthAttempt(state: string): OAuthAttempt | undefined {
  prune(Date.now())
  const attempt = attempts.get(state)
  attempts.delete(state)

  return attempt?.value
}

export function completeOAuthAttempt(attempt: OAuthAttempt, result: OAuthStatus) {
  results.set(attempt.sessionId, { value: result, expiresAt: Date.now() + OAUTH_TTL_MS })
  activeSessions.delete(attempt.sessionId)
}

export function takeOAuthResult(sessionId: string): OAuthStatus | undefined {
  const result = results.get(sessionId)
  results.delete(sessionId)

  return result && result.expiresAt > Date.now() ? result.value : undefined
}
