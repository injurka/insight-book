import { beforeEach, describe, expect, it, vi } from 'vitest'
import { clearAuthSession } from '../services/auth-session.service'
import { DefaultAuthRepository } from './auth.repository'

const mocks = vi.hoisted(() => ({ login: vi.fn(), oauthStatus: vi.fn(), discardSession: vi.fn() }))
vi.mock('../services/api.service', () => ({ api: { auth: mocks } }))

const pair = { accessToken: 'access', refreshToken: 'refresh-token-0000000001', expiresIn: 900 }
const user = { id: 991, username: 'test' }

describe('authentication repository', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })
  it('validates and stores token pairs from login and removes the previous account cache', async () => {
    localStorage.setItem('insight_uid', 'old-account')
    mocks.login.mockResolvedValue({ ...pair, user })
    expect((await new DefaultAuthRepository().login({ login: 'test', password: 'test' })).token).toBe(pair.accessToken)
    expect(JSON.parse(localStorage.getItem('insight_session')!).refreshToken).toBe(pair.refreshToken)
    expect(localStorage.getItem('insight_uid')).toBeNull()
  })
  it('does not restore or retain an in-flight login after logout', async () => {
    let complete!: (value: object) => void
    mocks.login.mockReturnValue(new Promise((resolve) => {
      complete = resolve
    }))
    const pending = new DefaultAuthRepository().login({ login: 'test', password: 'test' })
    clearAuthSession()
    complete({ ...pair, user })
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
    expect(localStorage.getItem('insight_token')).toBeNull()
    expect(mocks.discardSession).toHaveBeenCalled()
  })
  it('keeps OAuth polling free of session mutations until the caller accepts the result', async () => {
    mocks.oauthStatus.mockResolvedValue({ status: 'success', ...pair })
    const repository = new DefaultAuthRepository()
    const result = await repository.oauthStatus('test-session')
    expect(localStorage.getItem('insight_token')).toBeNull()
    repository.acceptOAuthSession(result)
    expect(localStorage.getItem('insight_token')).toBe(pair.accessToken)
  })
})
