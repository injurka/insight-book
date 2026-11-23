import { describe, expect, it, spyOn } from 'bun:test'
import { Elysia } from 'elysia'
import jwt from 'jsonwebtoken'
import { JWT_SECRET } from '../config'
import { authSessionService } from '../services/auth-session.service'
import { authService } from '../services/auth.service'
import { authRouter } from './auth.controller'

const pair = { accessToken: 'test-access', refreshToken: 'test-refresh-token-long-enough', expiresIn: 900 }

describe('Renewable desktop authentication routes', () => {
  it('rejects expired access tokens on me and upgrade, and upgrades valid legacy tokens', async () => {
    const create = spyOn(authSessionService, 'create').mockResolvedValue(pair)

    try {
      const app = new Elysia().use(authRouter)

      for (const path of ['me', 'session/upgrade']) {
        const response = await app.handle(new Request(`http://localhost/api/auth/${path}`, {
          method: path === 'me' ? 'GET' : 'POST',
          headers: { Authorization: `Bearer ${jwt.sign({ userId: 991 }, JWT_SECRET, { expiresIn: -1 })}` },
        }))
        expect(response.status).toBe(401)
      }

      expect(create).not.toHaveBeenCalled()
      const upgrade = await app.handle(new Request('http://localhost/api/auth/session/upgrade', {
        method: 'POST',
        headers: { Authorization: `Bearer ${jwt.sign({ userId: 991 }, JWT_SECRET)}` },
      }))
      expect(await upgrade.json()).toEqual(pair)
      expect(create).toHaveBeenCalledWith(991)
    }
    finally { create.mockRestore() }
  })

  it('redirects web OAuth with a one-use session id instead of tokens in the URL', async () => {
    const exchange = spyOn(authService, 'exchangeYandexCode').mockResolvedValue(jwt.sign({ userId: 991 }, JWT_SECRET))
    const create = spyOn(authSessionService, 'create').mockResolvedValue(pair)

    try {
      const app = new Elysia().use(authRouter)
      const start = await app.handle(new Request('http://localhost/api/auth/yandex?session=web'))
      const state = new URL(start.headers.get('Location')!).searchParams.get('state')!
      const callback = await app.handle(new Request(`http://localhost/api/auth/yandex/callback?code=test&state=${state}`))
      expect(callback.status).toBe(302)
      const location = new URL(callback.headers.get('Location')!)
      expect(location.pathname).toBe('/auth/yandex/callback')
      expect(location.searchParams.get('token')).toBeNull()
      expect(location.searchParams.get('refreshToken')).toBeNull()
      const sessionId = location.searchParams.get('session_id')!
      const response = await app.handle(new Request(`http://localhost/api/auth/status?session_id=${sessionId}`))
      expect(await response.json()).toEqual({ status: 'success', ...pair })
    }
    finally {
      exchange.mockRestore()
      create.mockRestore()
    }
  })

  it('returns private token pairs and forwards refresh and logout', async () => {
    const user = { id: 991, username: 'test', role: 'admin' as const }
    const login = spyOn(authService, 'login').mockResolvedValue({ token: 'legacy-token', user })
    const create = spyOn(authSessionService, 'create').mockResolvedValue(pair)
    const refresh = spyOn(authSessionService, 'refresh').mockResolvedValue(pair)
    const revoke = spyOn(authSessionService, 'revoke').mockResolvedValue({ success: true })

    try {
      const app = new Elysia().use(authRouter)

      for (const [route, body, expected] of [
        ['login', { login: 'test', password: 'test' }, { ...pair, user }],
        ['refresh', { refreshToken: pair.refreshToken }, pair],
        ['logout', { refreshToken: pair.refreshToken }, { success: true }],
      ] as const) {
        const response = await app.handle(new Request(`http://localhost/api/auth/session/${route}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': 'desktop-route-test' },
          body: JSON.stringify(body),
        }))
        expect(response.status).toBe(200)
        expect(response.headers.get('Cache-Control')).toContain('no-store')
        expect(await response.json()).toEqual(expected)
      }

      expect(create).toHaveBeenCalledWith(user.id)
      expect(refresh).toHaveBeenCalledWith(pair.refreshToken)
      expect(revoke).toHaveBeenCalledWith(pair.refreshToken)
    }
    finally {
      login.mockRestore()
      create.mockRestore()
      refresh.mockRestore()
      revoke.mockRestore()
    }
  })

  it('delivers Yandex desktop token pairs once and preserves legacy sessions', async () => {
    const legacyToken = jwt.sign({ userId: 991 }, JWT_SECRET)
    const exchange = spyOn(authService, 'exchangeYandexCode').mockResolvedValue(legacyToken)
    const create = spyOn(authSessionService, 'create').mockResolvedValue(pair)

    try {
      const app = new Elysia().use(authRouter)

      for (const desktop of [true, false]) {
        const sessionId = crypto.randomUUID()
        const start = await app.handle(new Request(`http://localhost/api/auth/yandex?session_id=${sessionId}${desktop ? '&session=desktop' : ''}`))
        expect(start.status).toBe(302)
        const state = new URL(start.headers.get('Location')!).searchParams.get('state')!
        const callback = await app.handle(new Request(`http://localhost/api/auth/yandex/callback?code=test&state=${encodeURIComponent(state)}`))
        expect(callback.status).toBe(200)
        const poll = () => app.handle(new Request(`http://localhost/api/auth/status?session_id=${sessionId}`))
        const response = await poll()
        expect(response.headers.get('Cache-Control')).toContain('no-store')
        expect(await response.json()).toEqual(desktop ? { status: 'success', ...pair } : { status: 'success', token: legacyToken })
        expect(await (await poll()).json()).toEqual({ status: 'pending' })
      }

      expect(create).toHaveBeenCalledTimes(1)
      expect(create).toHaveBeenCalledWith(991)
    }
    finally {
      exchange.mockRestore()
      create.mockRestore()
    }
  })
})

describe('Yandex OAuth completion', () => {
  const app = new Elysia().use(authRouter)
  const api = 'http://localhost/api/auth'
  const get = (path: string) => app.handle(new Request(`${api}${path}`))
  const status = async (sessionId: string) => (await get(`/status?session_id=${sessionId}`)).json()
  const stateFrom = (url: string) => new URL(url).searchParams.get('state')!

  it('renders the native completion page and delivers cancellation and failure once', async () => {
    const exchange = spyOn(authService, 'exchangeYandexCode').mockRejectedValue(new Error('provider detail'))

    try {
      for (const [callback, expected, title] of [
        ['error=access_denied', 'cancelled', 'Sign-in cancelled'],
        ['code=test', 'failed', 'Could not continue'],
        ['', 'failed', 'Could not continue'],
      ]) {
        const sessionId = crypto.randomUUID()
        const start = await get(`/yandex?session=desktop&session_id=${sessionId}&lang=en`)
        const state = stateFrom(start.headers.get('Location')!)
        expect(await status(sessionId)).toEqual({ status: 'pending' })

        const response = await get(`/yandex/callback?state=${state}&${callback}`)
        expect(response.headers.get('Cache-Control')).toContain('no-store')
        expect(response.headers.get('Referrer-Policy')).toBe('no-referrer')
        const html = await response.text()
        expect(html).toContain(title)
        expect(html).toContain('insightbook://auth/yandex/return')
        expect(html).not.toContain('provider detail')

        expect(await status(sessionId)).toEqual({ status: 'error', error: expected })
        expect(await status(sessionId)).toEqual({ status: 'pending' })
        expect((await get(`/yandex/callback?code=test&state=${state}`)).status).toBe(400)
      }

      expect(exchange).toHaveBeenCalledTimes(1)
    }
    finally {
      exchange.mockRestore()
    }
  })

  it('rejects unknown, missing and duplicate state before exchanging the provider code', async () => {
    const exchange = spyOn(authService, 'exchangeYandexCode')

    try {
      const start = await get('/yandex?session=web')
      const state = stateFrom(start.headers.get('Location')!)

      for (const query of ['', `&state=${crypto.randomUUID()}`, `&state=${state}&state=${state}`]) {
        const response = await get(`/yandex/callback?code=test${query}`)
        expect(response.status).toBe(400)
        expect(response.headers.get('Content-Type')).toContain('text/html')
      }

      expect(exchange).not.toHaveBeenCalled()
    }
    finally {
      exchange.mockRestore()
    }
  })

  it('rejects expired attempts and gives a session only to the first poller', async () => {
    const exchange = spyOn(authService, 'exchangeYandexCode')
      .mockResolvedValue(jwt.sign({ userId: 991 }, JWT_SECRET))
    const now = Date.now()
    const clock = spyOn(Date, 'now').mockReturnValue(now)

    try {
      const expiredId = crypto.randomUUID()
      const start = await get(`/yandex?session_id=${expiredId}`)
      const state = stateFrom(start.headers.get('Location')!)
      clock.mockReturnValue(now + 10 * 60_000 + 1)
      expect((await get(`/yandex/callback?code=test&state=${state}`)).status).toBe(400)
      expect(exchange).not.toHaveBeenCalled()

      const sessionId = crypto.randomUUID()
      const next = await get(`/yandex?session_id=${sessionId}`)
      const nextState = stateFrom(next.headers.get('Location')!)
      const callbacks = await Promise.all([
        get(`/yandex/callback?code=test&state=${nextState}`),
        get(`/yandex/callback?code=test&state=${nextState}`),
      ])
      expect(callbacks.map(response => response.status).sort()).toEqual([200, 400])
      expect(exchange).toHaveBeenCalledTimes(1)
      const results = await Promise.all([status(sessionId), status(sessionId)])
      expect(results.map(result => result.status).sort()).toEqual(['pending', 'success'])
    }
    finally {
      clock.mockRestore()
      exchange.mockRestore()
    }
  })

  it('binds linking to the authenticated user and rejects an expired legacy link credential', async () => {
    const link = spyOn(authService, 'linkYandex').mockResolvedValue(undefined)
    const sessionId = crypto.randomUUID()
    const start = (token?: string) => app.handle(new Request(`${api}/yandex/link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ sessionId, locale: 'zh' }),
    }))

    try {
      expect((await start()).status).toBe(401)
      const response = await start(jwt.sign({ userId: 991 }, JWT_SECRET, { expiresIn: 60 }))
      expect(response.status).toBe(200)
      const { redirectUrl } = await response.json()
      const state = stateFrom(redirectUrl)
      const completed = await get(`/yandex/callback?code=test&state=${state}`)
      expect(await completed.text()).toContain('Yandex ID 已绑定')
      expect(await status(sessionId)).toEqual({ status: 'success', linked: true })
      expect(link).toHaveBeenCalledWith(991, 'test')
      const expiredToken = jwt.sign({ userId: 991 }, JWT_SECRET, { expiresIn: -1 })
      expect((await get(`/yandex?linkToken=${expiredToken}`)).status).toBe(401)
    }
    finally {
      link.mockRestore()
    }
  })
})
