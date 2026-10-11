import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api, configureApi, request } from './api.service'
import { acceptAuthSession, clearAuthSession } from './auth-session.service'

const { transport, unauthorized, notification } = vi.hoisted(() => ({ transport: vi.fn(), unauthorized: vi.fn(), notification: vi.fn() }))
vi.mock('~/01.shared/lib/env', () => ({ API_URL: 'https://api.example.test', isTauri: false }))
vi.mock('./api-transport.service', () => ({ createApiFetch: () => transport }))
vi.mock('./monitoring.service', () => ({ recordApiError: vi.fn() }))
vi.mock('../../00.plugins/i18n', () => ({ i18n: { global: { te: () => false, t: (key: string) => key } } }))

const pair = { accessToken: 'access-1', refreshToken: 'refresh-token-00000000001', expiresIn: 900 }
const next = { accessToken: 'access-2', refreshToken: 'refresh-token-00000000002', expiresIn: 900 }
const reply = (body: object, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
function expire() {
  const stored = JSON.parse(localStorage.getItem('insight_session')!)
  localStorage.setItem('insight_session', JSON.stringify({ ...stored, expiresAt: 0 }))
}

describe('aPI session boundary', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
    configureApi({ onUnauthorized: unauthorized, onError: notification })
  })
  it('refreshes and retries through ofetch without reporting an authentication error', async () => {
    acceptAuthSession(pair)
    transport.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).endsWith('/refresh'))
        return reply(next)

      const token = new Headers(init?.headers).get('Authorization')

      return token === 'Bearer access-2' ? reply({ success: true }) : reply({ code: 'INVALID_TOKEN' }, 401)
    })
    expect(await request('/api/dictionary/review', { method: 'POST', body: JSON.stringify({ wordId: 1, grade: 3 }) })).toEqual({ success: true })
    expect(transport).toHaveBeenCalledTimes(3)
    expect(unauthorized).not.toHaveBeenCalled()
    expect(notification).not.toHaveBeenCalled()
  })
  it('preserves refresh failure status for silent me requests and clears revoked sessions', async () => {
    acceptAuthSession(pair)
    expire()
    transport.mockResolvedValue(reply({}, 401))
    await expect(api.auth.me()).rejects.toMatchObject({ status: 401 })
    expect(unauthorized).toHaveBeenCalledTimes(1)
    expect(localStorage.getItem('insight_token')).toBeNull()
  })
  it('keeps the session on temporary refresh failures', async () => {
    acceptAuthSession(pair)
    expire()
    transport.mockResolvedValue(reply({}, 503))
    await expect(api.auth.me()).rejects.toMatchObject({ status: 503 })
    expect(unauthorized).not.toHaveBeenCalled()
    expect(localStorage.getItem('insight_token')).toBe(pair.accessToken)
  })
  it('does not expire the current session for wrong login credentials', async () => {
    acceptAuthSession(pair)
    transport.mockResolvedValue(reply({ code: 'INVALID_CREDENTIALS' }, 401))
    await expect(api.auth.login({ login: 'test', password: 'wrong' })).rejects.toMatchObject({ status: 401 })
    expect(unauthorized).not.toHaveBeenCalled()
    expect(localStorage.getItem('insight_token')).toBe(pair.accessToken)
  })
  it('never sends the account token to an external host', async () => {
    acceptAuthSession(pair)
    transport.mockResolvedValue(reply({ success: true }))
    await request('https://external.example.test/api/resource')
    expect(new Headers(transport.mock.calls[0][1].headers).get('Authorization')).toBeNull()
    clearAuthSession()
  })
})
