import { beforeEach, describe, expect, it, vi } from 'vitest'
import { acceptAuthSession, authSessionIdentity, AuthSessionManager, clearAuthSession } from './auth-session.service'

const base = 'https://api.example.test'
const pair = { accessToken: 'access-1', refreshToken: 'refresh-token-00000000001', expiresIn: 900 }
const next = { accessToken: 'access-2', refreshToken: 'refresh-token-00000000002', expiresIn: 900 }
const reply = (body: object, status = 200) => new Response(JSON.stringify(body), { status })
const getToken = () => localStorage.getItem('insight_token')
function expire() {
  const session = JSON.parse(localStorage.getItem('insight_session')!)
  localStorage.setItem('insight_session', JSON.stringify({ ...session, expiresAt: 0 }))
}
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })

  return { promise, resolve }
}

describe('renewable client sessions', () => {
  beforeEach(() => {
    localStorage.clear()
  })
  it('refreshes once before concurrent requests and keeps the session identity', async () => {
    acceptAuthSession(pair)
    expire()
    const identity = authSessionIdentity()
    const rotation = deferred<Response>()
    const transport = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).endsWith('/refresh'))
        return rotation.promise

      expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer access-2')

      return reply({ success: true })
    })
    const fetch = new AuthSessionManager(transport, base).wrap(getToken)
    const requests = Promise.all([fetch(`${base}/api/books`), fetch(`${base}/api/dictionary`), fetch(`${base}/api/auth/me`)])
    await vi.waitFor(() => expect(transport).toHaveBeenCalledTimes(1))
    rotation.resolve(reply(next))
    await requests
    expect(transport.mock.calls.filter(([url]) => String(url).endsWith('/refresh'))).toHaveLength(1)
    expect(authSessionIdentity()).toBe(identity)
    expect(JSON.parse(localStorage.getItem('insight_session')!).refreshToken).toBe(next.refreshToken)
  })
  it('replays a rejected POST once with its original body after a 401', async () => {
    acceptAuthSession(pair)
    const transport = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).endsWith('/refresh'))
        return reply(next)

      expect(init?.body).toBe('{"grade":3}')

      return reply({}, new Headers(init?.headers).get('Authorization') === 'Bearer access-1' ? 401 : 200)
    })
    const fetch = new AuthSessionManager(transport, base).wrap(getToken)
    expect((await fetch(`${base}/api/dictionary/review`, { method: 'POST', body: '{"grade":3}' })).status).toBe(200)
    expect(transport).toHaveBeenCalledTimes(3)
  })
  it('does not loop when the renewed token is also rejected', async () => {
    acceptAuthSession(pair)
    const transport = vi.fn(async (input: RequestInfo | URL) => String(input).endsWith('/refresh') ? reply(next) : reply({}, 401))
    expect((await new AuthSessionManager(transport, base).wrap(getToken)(`${base}/api/books`)).status).toBe(401)
    expect(transport).toHaveBeenCalledTimes(3)
  })
  it('keeps tokens on temporary failures and never replays a network-failed write', async () => {
    acceptAuthSession(pair)
    expire()
    const transport = vi.fn(async () => reply({}, 503))
    const manager = new AuthSessionManager(transport, base)
    await expect(manager.wrap(getToken)(`${base}/api/books`)).rejects.toMatchObject({ status: 503 })
    expect(getToken()).toBe(pair.accessToken)
    clearAuthSession()
    transport.mockRejectedValue(new TypeError('Failed to fetch'))
    await expect(manager.wrap(getToken)(`${base}/api/dictionary/review`, { method: 'POST', body: '{}' })).rejects.toThrow('Failed to fetch')
    expect(transport).toHaveBeenCalledTimes(2)
  })
  it('clears an expired or revoked refresh session', async () => {
    acceptAuthSession(pair)
    expire()
    await expect(new AuthSessionManager(async () => reply({}, 401), base).ensure()).rejects.toMatchObject({ status: 401 })
    expect(getToken()).toBeNull()
    expect(localStorage.getItem('insight_session')).toBeNull()
  })
  it('does not restore a session after logout during rotation', async () => {
    acceptAuthSession(pair)
    expire()
    const rotation = deferred<Response>()
    const transport = vi.fn(async (input: RequestInfo | URL) => String(input).endsWith('/refresh') ? rotation.promise : reply({ success: true }))
    const manager = new AuthSessionManager(transport, base)
    const pending = manager.ensure()
    await vi.waitFor(() => expect(transport).toHaveBeenCalledTimes(1))
    await manager.logout()
    rotation.resolve(reply(next))
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
    expect(getToken()).toBeNull()
    expect(transport.mock.calls.filter(([url]) => String(url).endsWith('/logout'))).toHaveLength(2)
  })
  it('does not overwrite a new login with an old refresh response', async () => {
    acceptAuthSession(pair)
    expire()
    const rotation = deferred<Response>()
    const transport = vi.fn(async (input: RequestInfo | URL) => String(input).endsWith('/refresh') ? rotation.promise : reply({ success: true }))
    const manager = new AuthSessionManager(transport, base)
    const pending = manager.ensure()
    await vi.waitFor(() => expect(transport).toHaveBeenCalledTimes(1))
    acceptAuthSession({ ...next, accessToken: 'different-account' })
    rotation.resolve(reply(next))
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
    expect(getToken()).toBe('different-account')
  })
  it('upgrades a valid legacy token without changing the session identity', async () => {
    acceptAuthSession({ token: 'legacy' })
    const transport = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe(`${base}/api/auth/session/upgrade`)
      expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer legacy')

      return reply(pair)
    })
    await new AuthSessionManager(transport, base).ensure()
    expect(authSessionIdentity()).toBe('legacy')
    expect(getToken()).toBe(pair.accessToken)
  })
  it('supports old deployments without repeating unsupported upgrades', async () => {
    acceptAuthSession({ token: 'legacy' })
    const transport = vi.fn(async () => reply({}, 404))
    const manager = new AuthSessionManager(transport, base)
    await manager.ensure()
    await manager.ensure()
    expect(transport).toHaveBeenCalledTimes(1)
    expect(getToken()).toBe('legacy')
  })
  it('serializes separate managers with the browser lock', async () => {
    let tail = Promise.resolve<unknown>(undefined)
    const requestLock = vi.fn((_name: string, run: () => Promise<unknown>) => {
      const result = tail.then(run)
      tail = result.catch(() => {})

      return result
    })
    vi.stubGlobal('navigator', { locks: { request: requestLock } })

    try {
      acceptAuthSession(pair)
      expire()
      const transport = vi.fn(async () => reply(next))
      await Promise.all([new AuthSessionManager(transport, base).ensure(), new AuthSessionManager(transport, base).ensure()])
      expect(transport).toHaveBeenCalledTimes(1)
      expect(requestLock).toHaveBeenCalledTimes(2)
    }
    finally { vi.unstubAllGlobals() }
  })
})
