import { beforeEach, describe, expect, it, vi } from 'vitest'
import { clearAuthSession } from '../services/auth-session.service'
import { DefaultAuthRepository } from './auth.repository'

const mocks = vi.hoisted(() => ({
  login: vi.fn(),
  register: vi.fn(),
  logout: vi.fn(),
  me: vi.fn(),
  sendCode: vi.fn(),
  oauthStatus: vi.fn(),
  discardSession: vi.fn(),
  updateAvatar: vi.fn(),
  updateUsername: vi.fn(),
  unlinkProvider: vi.fn(),
}))
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
    const controller = new AbortController()
    const repository = new DefaultAuthRepository()
    const result = await repository.oauthStatus('test-session', { signal: controller.signal })
    expect(mocks.oauthStatus).toHaveBeenCalledWith('test-session', { signal: controller.signal })
    expect(localStorage.getItem('insight_token')).toBeNull()
    repository.acceptOAuthSession(result)
    expect(localStorage.getItem('insight_token')).toBe(pair.accessToken)
  })
  it('stores legacy tokens and clears cached account keys', () => {
    localStorage.setItem('insight_uid', 'old-account')
    localStorage.setItem('insight_user_data', '{}')
    localStorage.setItem('insight_auth_mode', 'multi')

    new DefaultAuthRepository().acceptLegacyToken('legacy-token')

    expect(localStorage.getItem('insight_token')).toBe('legacy-token')
    expect(localStorage.getItem('insight_uid')).toBeNull()
    expect(localStorage.getItem('insight_user_data')).toBeNull()
    expect(localStorage.getItem('insight_auth_mode')).toBeNull()
  })
  it('validates register responses and discards cancelled registrations', async () => {
    const repository = new DefaultAuthRepository()
    mocks.register.mockResolvedValueOnce({ ...pair, user })
    const registered = await repository.register({ email: 'a@b.test', code: '123456', username: 'test', password: 'secret' })
    expect(registered.token).toBe(pair.accessToken)

    let complete!: (value: object) => void
    mocks.register.mockReturnValueOnce(new Promise((resolve) => {
      complete = resolve
    }))
    const pending = repository.register({ email: 'a@b.test', code: '123456', username: 'test', password: 'secret' })
    clearAuthSession()
    complete({ ...pair, user })
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
    expect(mocks.discardSession).toHaveBeenCalled()
  })
  it('delegates logout, me, sendCode, updateAvatar, updateUsername, and unlinkProvider', async () => {
    const repository = new DefaultAuthRepository()
    const avatar = new File(['png'], 'avatar.png', { type: 'image/png' })
    mocks.logout.mockResolvedValue(undefined)
    mocks.me.mockResolvedValue({ user, mode: 'multi' })
    mocks.sendCode.mockResolvedValue({ success: true, message: 'sent' })
    mocks.updateAvatar.mockResolvedValue({ avatarUrl: '/a.png' })
    mocks.updateUsername.mockResolvedValue({ username: 'new-name' })
    mocks.unlinkProvider.mockResolvedValue({ success: true, user })

    await repository.logout()
    expect(mocks.logout).toHaveBeenCalledOnce()

    await expect(repository.me()).resolves.toMatchObject({ mode: 'multi', user: { id: 991, username: 'test' } })
    await expect(repository.sendCode({ email: 'a@b.test' })).resolves.toEqual({ success: true, message: 'sent' })
    await expect(repository.updateAvatar(avatar)).resolves.toEqual({ avatarUrl: '/a.png' })
    await expect(repository.updateUsername('new-name')).resolves.toEqual({ username: 'new-name' })
    await expect(repository.unlinkProvider('yandex')).resolves.toEqual({ success: true, user })
  })
})
