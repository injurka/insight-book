import { Elysia, t } from 'elysia'
import jwt from 'jsonwebtoken'
import { AUTH_MODE, CORS_HEADERS, FRONTEND_URL, JWT_SECRET } from '../config'
import { ERROR_CODES } from '../constants/error-codes'
import { authService } from '../services/auth.service'
import { cachePlugin } from '../utils/cache'
import { AppError, handleElysiaError } from '../utils/errors'
import { createRateLimiter, getClientIp } from '../utils/rate-limit'

const authPlugin = new Elysia({ name: 'auth-plugin' })
  .derive(({ request }) => {
    let userId: number | null = null
    if (AUTH_MODE === 'single') {
      userId = 1
    }
    else {
      const authHeader = request.headers.get('Authorization')
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1]
        try {
          const decoded = jwt.verify(token, JWT_SECRET) as { userId: number }
          userId = decoded.userId
        }
        catch { }
      }
    }
    return { userId }
  })
  .macro({
    requireAuth(value: boolean) {
      if (!value)
        return

      return {
        beforeHandle: ({ userId }: { userId?: number | null }) => {
          if (!userId)
            throw new AppError(401, ERROR_CODES.AUTH.UNAUTHORIZED, 'Unauthorized')
        },
      }
    },
  })
  .as('global')

const authSessions = new Map<string, string>()

const authLimiter = createRateLimiter(5, 60 * 1000)

export const authRouter = new Elysia({ prefix: '/api/auth' })
  .use(authPlugin)
  .use(cachePlugin)
  .onError(handleElysiaError)
  .post('/login', async ({ body, request }) => {
    authLimiter(getClientIp(request))
    return authService.login(body.login, body.password)
  }, {
    body: t.Object({
      login: t.String({ minLength: 1, error: 'Логин или email обязателен' }),
      password: t.String({ minLength: 1, error: 'Пароль обязателен' }),
    }),
  })
  .post('/send-code', async ({ body, request }) => {
    authLimiter(getClientIp(request))
    return authService.sendCode(body.email)
  }, {
    body: t.Object({
      email: t.String({ format: 'email', error: 'Некорректный email' }),
    }),
  })
  .post('/register', async ({ body, request }) => {
    authLimiter(getClientIp(request))
    return authService.register(body.email, body.code, body.password)
  }, {
    body: t.Object({
      email: t.String({ format: 'email', error: 'Некорректный email' }),
      code: t.String({ minLength: 6, maxLength: 6, error: 'Код должен состоять из 6 цифр' }),
      password: t.String({ minLength: 6, error: 'Пароль должен быть не менее 6 символов' }),
    }),
  })
  .get('/yandex', async ({ query }) => {
    const sessionId = query.session_id as string | undefined
    const linkToken = query.linkToken as string | undefined
    let linkUserId: number | undefined
    if (linkToken) {
      try {
        const decoded = jwt.verify(linkToken, JWT_SECRET) as { userId: number }
        linkUserId = decoded.userId
      }
      catch { }
    }

    let state: string | undefined
    if (sessionId || linkUserId) {
      const stateObj = {
        sessionId: sessionId || undefined,
        linkUserId: linkUserId || undefined,
        nonce: crypto.randomUUID(),
      }
      state = Buffer.from(JSON.stringify(stateObj)).toString('base64url')
    }

    const res = await authService.handleYandexAuth(state)
    return Response.redirect(res.redirectUrl, 302)
  })
  .get('/yandex/callback', async ({ query, set }) => {
    const code = query.code as string | undefined
    const state = query.state as string | undefined
    if (!code)
      throw new AppError(400, ERROR_CODES.AUTH.NO_CODE_PROVIDED, 'No code provided')

    let sessionId: string | undefined
    let linkUserId: number | undefined

    if (state) {
      try {
        const parsed = JSON.parse(Buffer.from(state, 'base64url').toString('utf-8'))
        sessionId = parsed.sessionId
        linkUserId = parsed.linkUserId ? Number(parsed.linkUserId) : undefined
      }
      catch {
        sessionId = state
      }
    }

    if (linkUserId) {
      try {
        await authService.linkYandex(linkUserId, code)

        if (sessionId) {
          authSessions.set(sessionId, JSON.stringify({ status: 'success', linked: true }))
          const html = `
            <!DOCTYPE html>
            <html lang="ru">
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1">
              <title>Привязка аккаунта</title>
              <style>
                body { font-family: sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; background: #0d1117; color: #fff; text-align: center; }
                .icon { font-size: 64px; margin-bottom: 16px; color: #22c55e; }
              </style>
            </head>
            <body>
              <div class="icon">✓</div>
              <h2>Аккаунт Яндекс успешно привязан!</h2>
              <p style="color: #8b949e;">Вы можете закрыть этот браузер и вернуться в приложение InsightBook.</p>
            </body>
            </html>
          `
          set.headers['Content-Type'] = 'text/html; charset=utf-8'
          return html
        }

        const frontendUrl = new URL(FRONTEND_URL)
        frontendUrl.pathname = '/settings'
        frontendUrl.searchParams.set('oauth_success', 'yandex_linked')
        return Response.redirect(frontendUrl.toString(), 302)
      }
      catch (error: unknown) {
        const errMessage = error instanceof Error ? error.message : 'Не удалось привязать Яндекс аккаунт'
        if (sessionId) {
          authSessions.set(sessionId, JSON.stringify({ status: 'error', error: errMessage }))
          const html = `
            <!DOCTYPE html>
            <html lang="ru">
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1">
              <title>Ошибка привязки</title>
              <style>
                body { font-family: sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; background: #0d1117; color: #fff; text-align: center; }
                .icon { font-size: 64px; margin-bottom: 16px; color: #ef4444; }
              </style>
            </head>
            <body>
              <div class="icon">✕</div>
              <h2>Не удалось привязать аккаунт</h2>
              <p style="color: #8b949e;">${errMessage}</p>
            </body>
            </html>
          `
          set.headers['Content-Type'] = 'text/html; charset=utf-8'
          return html
        }

        const frontendUrl = new URL(FRONTEND_URL)
        frontendUrl.pathname = '/settings'
        frontendUrl.searchParams.set('oauth_error', errMessage)
        return Response.redirect(frontendUrl.toString(), 302)
      }
    }

    const token = await authService.exchangeYandexCode(code)

    if (sessionId) {
      authSessions.set(sessionId, token)
      const html = `
        <!DOCTYPE html>
        <html lang="ru">
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <title>Авторизация</title>
          <style>
            body { font-family: sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; background: #0d1117; color: #fff; text-align: center; }
            .icon { font-size: 64px; margin-bottom: 16px; color: #22c55e; }
          </style>
        </head>
        <body>
          <div class="icon">✓</div>
          <h2>Вход успешно выполнен!</h2>
          <p style="color: #8b949e;">Вы можете закрыть этот браузер и вернуться в приложение InsightBook.</p>
        </body>
        </html>
      `
      set.headers['Content-Type'] = 'text/html; charset=utf-8'
      return html
    }

    const frontendUrl = new URL(FRONTEND_URL)
    frontendUrl.pathname = '/auth/yandex/callback'
    frontendUrl.searchParams.set('token', token)
    return Response.redirect(frontendUrl.toString(), 302)
  })
  .get('/status', async ({ query }) => {
    const sessionId = query.session_id as string | undefined
    if (!sessionId)
      throw new AppError(400, ERROR_CODES.AUTH.NO_SESSION_ID, 'No session id')

    const sessionData = authSessions.get(sessionId)
    if (sessionData) {
      authSessions.delete(sessionId)
      try {
        const parsed = JSON.parse(sessionData)
        return parsed
      }
      catch {
        return { status: 'success', token: sessionData }
      }
    }
    return { status: 'pending' }
  })
  .post('/unlink-provider', async ({ userId, body }) => {
    return authService.unlinkProvider(userId as number, body.provider)
  }, {
    requireAuth: true,
    body: t.Object({
      provider: t.String({ minLength: 1 }),
    }),
  })
  .get('/me', async ({ userId }) => {
    return authService.getMe(userId)
  }, { cache: 'shortPrivate' })
  .patch('/me/avatar', async ({ userId, body }) => {
    const file = (body as { file: File }).file as File
    if (!file)
      throw new AppError(400, ERROR_CODES.BOOK.FILE_REQUIRED, 'File required')
    return authService.updateAvatar(userId as number, file)
  }, { requireAuth: true })
  .patch('/me/username', async ({ userId, body }) => {
    return authService.updateUsername(userId as number, (body as { username: string }).username)
  }, {
    requireAuth: true,
    body: t.Object({
      username: t.String({ minLength: 2, error: 'Некорректное имя пользователя' }),
    }),
  })

export const authUploadsRouter = new Elysia({ prefix: '/api/uploads/avatars' })
  .use(cachePlugin)
  .get('/:filename', async ({ params: { filename }, set }) => {
    const fileData = await authService.getAvatarImage(filename)
    if (!fileData) {
      set.status = 404
      return 'Not found'
    }

    set.headers = {
      ...CORS_HEADERS,
      'Content-Type': fileData.contentType,
    }
    return Buffer.from(fileData.buffer)
  }, { cache: 'immutable' })
