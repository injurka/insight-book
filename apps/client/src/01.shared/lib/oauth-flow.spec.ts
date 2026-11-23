import { beforeEach, describe, expect, it } from 'vitest'
import { claimWebOAuthAttempt, clearNativeOAuthAttempt, loadNativeOAuthAttempt, saveNativeOAuthAttempt, WEB_OAUTH_ATTEMPT_KEY, webOAuthAttemptValue } from './oauth-flow'

describe('web OAuth handoff', () => {
  beforeEach(() => sessionStorage.clear())

  it('only accepts a matching attempt once', () => {
    sessionStorage.setItem(WEB_OAUTH_ATTEMPT_KEY, webOAuthAttemptValue('attempt', null))
    expect(claimWebOAuthAttempt('attempt', null, sessionStorage)).toBe(true)
    expect(claimWebOAuthAttempt('attempt', null, sessionStorage)).toBe(false)
  })

  it('ignores foreign callbacks without consuming the pending attempt', () => {
    sessionStorage.setItem(WEB_OAUTH_ATTEMPT_KEY, webOAuthAttemptValue('attempt', null))
    expect(claimWebOAuthAttempt('other-attempt', null, sessionStorage)).toBe(false)
    expect(claimWebOAuthAttempt(['attempt', 'attempt'], null, sessionStorage)).toBe(false)
    expect(claimWebOAuthAttempt('attempt', 'signed-in-account', sessionStorage)).toBe(false)
    expect(claimWebOAuthAttempt('attempt', null, sessionStorage)).toBe(true)
  })
})

describe('native OAuth handoff', () => {
  beforeEach(() => localStorage.clear())

  it('resumes a pending attempt after the app restarts and stops after cancellation', () => {
    const attempt = { sessionId: 'attempt', identity: null, expiresAt: Date.now() + 60_000 }
    saveNativeOAuthAttempt(localStorage, attempt)
    expect(loadNativeOAuthAttempt(localStorage, null)).toEqual(attempt)
    clearNativeOAuthAttempt(localStorage, attempt)
    expect(loadNativeOAuthAttempt(localStorage, null)).toBeNull()
  })

  it('ignores expired attempts and attempts belonging to a previous session', () => {
    saveNativeOAuthAttempt(localStorage, { sessionId: 'expired', identity: null, expiresAt: Date.now() - 1 })
    expect(loadNativeOAuthAttempt(localStorage, null)).toBeNull()
    saveNativeOAuthAttempt(localStorage, { sessionId: 'previous', identity: 'previous-account', expiresAt: Date.now() + 60_000 })
    expect(loadNativeOAuthAttempt(localStorage, 'current-account')).toBeNull()
  })
})
