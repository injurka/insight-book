import { describe, expect, it, spyOn } from 'bun:test'
import { Elysia } from 'elysia'
import jwt from 'jsonwebtoken'
import { JWT_SECRET } from '../config'
import { authSessionService } from '../services/auth-session.service'
import { authService } from '../services/auth.service'
import { authRouter } from './auth.controller'

const pair = { accessToken: 'test-access', refreshToken: 'test-refresh-token-long-enough', expiresIn: 900 }

describe('Renewable desktop authentication routes', () => {
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
