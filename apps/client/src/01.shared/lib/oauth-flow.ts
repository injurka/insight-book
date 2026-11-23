export const WEB_OAUTH_ATTEMPT_KEY = 'insight-yandex-oauth-attempt'

export function oauthErrorKey(error?: string) {
  switch (error) {
    case 'cancelled': return 'signIn.oauthCancelled'
    case 'account_conflict': return 'signIn.oauthConflict'
    default: return 'signIn.errorAuth'
  }
}

export function webOAuthAttemptValue(sessionId: string, identity: string | null): string {
  return JSON.stringify([sessionId, identity])
}

export function claimWebOAuthAttempt(sessionId: unknown, identity: string | null, storage: Pick<Storage, 'getItem' | 'removeItem'>): sessionId is string {
  if (typeof sessionId !== 'string' || !sessionId
    || storage.getItem(WEB_OAUTH_ATTEMPT_KEY) !== webOAuthAttemptValue(sessionId, identity)) {
    return false
  }

  storage.removeItem(WEB_OAUTH_ATTEMPT_KEY)

  return true
}

export const OAUTH_ATTEMPT_TTL_MS = 10 * 60_000
const NATIVE_OAUTH_ATTEMPT_KEY = 'insight-native-yandex-oauth-attempt'

export interface NativeOAuthAttempt {
  sessionId: string
  identity: string | null
  expiresAt: number
}

export function saveNativeOAuthAttempt(storage: Storage, attempt: NativeOAuthAttempt): void {
  storage.setItem(NATIVE_OAUTH_ATTEMPT_KEY, JSON.stringify(attempt))
}

export function loadNativeOAuthAttempt(storage: Storage, identity: string | null): NativeOAuthAttempt | null {
  const raw = storage.getItem(NATIVE_OAUTH_ATTEMPT_KEY)

  if (!raw)
    return null

  try {
    const value: Partial<NativeOAuthAttempt> | null = JSON.parse(raw)

    if (value && typeof value.sessionId === 'string' && value.identity === identity
      && typeof value.expiresAt === 'number' && value.expiresAt > Date.now()) {
      return { sessionId: value.sessionId, identity, expiresAt: value.expiresAt }
    }
  }
  catch {
    // Clear invalid storage left behind by incomplete or older attempts.
  }

  storage.removeItem(NATIVE_OAUTH_ATTEMPT_KEY)

  return null
}

export function clearNativeOAuthAttempt(storage: Storage, attempt: NativeOAuthAttempt): void {
  if (storage.getItem(NATIVE_OAUTH_ATTEMPT_KEY) === JSON.stringify(attempt))
    storage.removeItem(NATIVE_OAUTH_ATTEMPT_KEY)
}
