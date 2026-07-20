import { Elysia, t } from 'elysia'
import jwt from 'jsonwebtoken'
import { AUTH_MODE, CORS_HEADERS, FRONTEND_URL, JWT_SECRET } from '../config'
import { authService } from '../services/auth.service'
import { AppError } from '../utils/errors'

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
  .macro(({ onBeforeHandle }) => ({
    requireAuth(value: boolean) {
      if (!value)
        return
      onBeforeHandle(({ userId }: { userId?: number | null }) => {
        if (!userId)
          throw new AppError(401, 'Необходима авторизация')
      })
    },
  }))

const authSessions = new Map<string, string>()

export const authRouter = new Elysia({ prefix: '/api/auth' })
  .use(authPlugin)
  .onError(({ error, set }) => {
    if (error instanceof AppError) {
      set.status = error.statusCode
      return { error: error.message }
    }
    set.status = 500
    return { error: 'Internal Server Error' }
  })
  .post('/login', async ({ body }) => {
    return authService.login(body.login, body.password)
  }, {
    body: t.Object({
      login: t.String({ minLength: 1, error: 'Логин или email обязателен' }),
      password: t.String({ minLength: 1, error: 'Пароль обязателен' }),
    }),
  })
  .post('/send-code', async ({ body }) => {
    return authService.sendCode(body.email)
  }, {
    body: t.Object({
      email: t.String({ format: 'email', error: 'Некорректный email' }),
    }),
  })
  .post('/register', async ({ body }) => {
    return authService.register(body.email, body.code, body.password)
  }, {
    body: t.Object({
      email: t.String({ format: 'email', error: 'Некорректный email' }),
      code: t.String({ minLength: 6, maxLength: 6, error: 'Код должен состоять из 6 цифр' }),
      password: t.String({ minLength: 6, error: 'Пароль должен быть не менее 6 символов' }),
    }),
  })
  .get('/yandex', async ({ query, set }) => {
    const sessionId = query.session_id as string | undefined
    const res = await authService.handleYandexAuth(sessionId)
    set.redirect = res.redirectUrl
  })
  .get('/yandex/callback', async ({ query, set }) => {
    const code = query.code as string | undefined
    const state = query.state as string | undefined
    if (!code)
      throw new AppError(400, 'No code provided')

    const token = await authService.exchangeYandexCode(code)

    if (state && state.length > 10) {
      authSessions.set(state, token)
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
    set.redirect = frontendUrl.toString()
  })
  .post('/yandex/mobile-exchange', async () => {
    throw new AppError(400, 'Not implemented')
  })
  .get('/status', async ({ query }) => {
    const sessionId = query.session_id as string | undefined
    if (!sessionId)
      throw new AppError(400, 'No session id')

    const token = authSessions.get(sessionId)
    if (token) {
      authSessions.delete(sessionId)
      return { status: 'success', token }
    }
    return { status: 'pending' }
  })
  .get('/me', async ({ userId }: any) => {
    return authService.getMe(userId as number)
  })
  .patch('/me/avatar', async ({ userId, body }: any) => {
    const file = (body as { file: File }).file as File
    if (!file)
      throw new AppError(400, 'Файл не передан')
    return authService.updateAvatar(userId as number, file)
  }, { requireAuth: true })
  .patch('/me/username', async ({ userId, body }: any) => {
    return authService.updateUsername(userId as number, (body as { username: string }).username)
  }, {
    requireAuth: true,
    body: t.Object({
      username: t.String({ minLength: 2, error: 'Некорректное имя пользователя' }),
    }),
  })

export const authUploadsRouter = new Elysia({ prefix: '/api/uploads/avatars' })
  .get('/:filename', async ({ params: { filename }, set }) => {
    const fileData = await authService.getAvatarImage(filename)
    if (!fileData) {
      set.status = 404
      return 'Not found'
    }

    set.headers = {
      ...CORS_HEADERS,
      'Content-Type': fileData.contentType,
      'Cache-Control': 'public, max-age=31536000, immutable',
    }
    return Buffer.from(fileData.buffer)
  })
