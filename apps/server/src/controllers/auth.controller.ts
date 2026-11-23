import type { OAuthAttempt, OAuthStatus } from '../services/yandex-oauth.service'
import { Elysia, t } from 'elysia'
import jwt from 'jsonwebtoken'
import { AUTH_MODE, CORS_HEADERS, FRONTEND_URL, JWT_SECRET } from '../config'
import { ERROR_CODES } from '../constants/error-codes'
import { authSessionService } from '../services/auth-session.service'
import { authService } from '../services/auth.service'
import { completeOAuthAttempt, startOAuthAttempt, takeOAuthAttempt, takeOAuthResult } from '../services/yandex-oauth.service'
import { cachePlugin } from '../utils/cache'
import { AppError, handleElysiaError } from '../utils/errors'
import { logger } from '../utils/logger'
import { createRateLimiter, getClientIp } from '../utils/rate-limit'
import { getOAuthLocale, oauthHeaders, oauthResultPage } from '../views/oauth-result'

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

const oauthStartLimiter = createRateLimiter(20, 60_000)
const oauthId = t.String({ pattern: '^[A-Za-z0-9_-]{22,128}$' })

function oauthRedirect(location: string | URL) {
  return new Response(null, { status: 302, headers: { ...oauthHeaders, Location: String(location) } })
}

function getLegacyLinkUserId(token: string): number {
  try {
    const payload = jwt.verify(token, JWT_SECRET)

    if (typeof payload !== 'string' && Number.isSafeInteger(payload.userId) && payload.userId > 0)
      return payload.userId
  }
  catch { }

  throw new AppError(401, ERROR_CODES.AUTH.INVALID_TOKEN, 'Invalid token')
}

async function resolveOAuthResult(attempt: OAuthAttempt, code?: string, providerError?: string): Promise<OAuthStatus> {
  if (providerError || !code)
    return { status: 'error', error: providerError === 'access_denied' ? 'cancelled' : 'failed' }

  try {
    if (attempt.linkUserId) {
      await authService.linkYandex(attempt.linkUserId, code)

      return { status: 'success', linked: true }
    }

    const token = await authService.exchangeYandexCode(code)

    if (attempt.mode === 'legacy')
      return { status: 'success', token }

    const { userId } = jwt.verify(token, JWT_SECRET) as { userId: number }

    return { status: 'success', ...await authSessionService.create(userId) }
  }
  catch (error) {
    const conflict = error instanceof AppError && (
      error.code === ERROR_CODES.AUTH.OAUTH_ALREADY_LINKED || error.code === ERROR_CODES.AUTH.EMAIL_ALREADY_EXISTS
    )

    if (!conflict) {
      logger.warn({
        reason: error instanceof AppError ? error.code : error instanceof Error ? error.name : 'unknown',
        action: attempt.linkUserId ? 'link' : 'login',
      }, 'Yandex OAuth callback failed')
    }

    return { status: 'error', error: conflict ? 'account_conflict' : 'failed' }
  }
}

const sessionLimiter = createRateLimiter(60, 60 * 1000)
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
  .post('/session/login', async ({ body, request }) => {
    authLimiter(getClientIp(request))
    const result = await authService.login(body.login, body.password)

    return { ...await authSessionService.create(result.user.id), user: result.user }
  }, {
    cache: 'shortPrivate',
    body: t.Object({ login: t.String({ minLength: 1 }), password: t.String({ minLength: 1 }) }),
  })
  .post('/session/refresh', async ({ body, request }) => {
    sessionLimiter(getClientIp(request))

    return authSessionService.refresh(body.refreshToken)
  }, {
    cache: 'shortPrivate',
    body: t.Object({ refreshToken: t.String({ minLength: 20, maxLength: 200 }) }),
  })
  .post('/session/upgrade', async ({ userId, request }) => {
    sessionLimiter(getClientIp(request))

    return authSessionService.create(userId!)
  }, { requireAuth: true, cache: 'shortPrivate' })
  .post('/session/register', async ({ body, request }) => {
    authLimiter(getClientIp(request))
    const result = await authService.register(body.email, body.code, body.password)

    return { ...await authSessionService.create(result.user.id), user: result.user }
  }, {
    cache: 'shortPrivate',
    body: t.Object({ email: t.String({ format: 'email' }), code: t.String({ minLength: 6, maxLength: 6 }), password: t.String({ minLength: 6 }) }),
  })
  .post('/session/logout', async ({ body }) => {
    return authSessionService.revoke(body.refreshToken)
  }, {
    cache: 'shortPrivate',
    body: t.Object({ refreshToken: t.String({ minLength: 20, maxLength: 200 }) }),
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
  .get('/yandex', async ({ query, request }) => {
    oauthStartLimiter(getClientIp(request))
    // Older native clients pass the link credential in the URL.
    const linkUserId = query.linkToken === undefined ? undefined : getLegacyLinkUserId(query.linkToken)
    const mode = query.session ?? (query.session_id ? 'legacy' : 'web')
    const locale = getOAuthLocale(query.lang || request.headers.get('Accept-Language') || undefined)
    const state = startOAuthAttempt({ sessionId: query.session_id ?? crypto.randomUUID(), mode, locale, linkUserId })

    return oauthRedirect((await authService.handleYandexAuth(state)).redirectUrl)
  }, {
    query: t.Object({
      session_id: t.Optional(oauthId),
      session: t.Optional(t.Union([t.Literal('desktop'), t.Literal('web')])),
      lang: t.Optional(t.String({ maxLength: 32 })),
      linkToken: t.Optional(t.String({ maxLength: 2048 })),
    }),
  })
  .post('/yandex/link', async ({ userId, body, request, set }) => {
    oauthStartLimiter(getClientIp(request))
    Object.assign(set.headers, oauthHeaders)
    const state = startOAuthAttempt({
      sessionId: body.sessionId ?? crypto.randomUUID(),
      mode: body.sessionId ? 'desktop' : 'web',
      locale: getOAuthLocale(body.locale),
      linkUserId: userId!,
    })

    return authService.handleYandexAuth(state)
  }, {
    requireAuth: true,
    body: t.Object({ sessionId: t.Optional(oauthId), locale: t.Optional(t.String({ maxLength: 32 })) }),
  })
  .get('/yandex/callback', async ({ request }) => {
    const query = new URL(request.url).searchParams
    const state = query.get('state')
    const attempt = state && query.getAll('state').length === 1 ? takeOAuthAttempt(state) : undefined

    if (!attempt) {
      const locale = getOAuthLocale(request.headers.get('Accept-Language') || undefined)

      return oauthResultPage(
        'expired',
        locale,
        new URL('/sign-in', FRONTEND_URL),
        false,
        400,
      )
    }

    const code = query.getAll('code').length === 1 ? query.get('code') ?? undefined : undefined
    const result = await resolveOAuthResult(attempt, code, query.has('error') ? query.get('error') || 'failed' : undefined)
    completeOAuthAttempt(attempt, result)

    if (attempt.mode !== 'web') {
      const page = result.status === 'error'
        ? result.error === 'cancelled' ? 'cancelled' : 'failed'
        : attempt.linkUserId ? 'linked' : 'success'

      return oauthResultPage(
        page,
        attempt.locale,
        new URL('insightbook://auth/yandex/return'),
        true,
      )
    }

    if (attempt.linkUserId) {
      const location = new URL('/settings', FRONTEND_URL)

      if (result.status === 'error')
        location.searchParams.set('oauth_error', result.error)
      else
        location.searchParams.set('oauth_success', 'yandex_linked')

      takeOAuthResult(attempt.sessionId)

      return oauthRedirect(location)
    }

    const location = new URL('/auth/yandex/callback', FRONTEND_URL)
    location.searchParams.set('session_id', attempt.sessionId)

    return oauthRedirect(location)
  })
  .get('/status', ({ query, set }) => {
    Object.assign(set.headers, oauthHeaders)

    return takeOAuthResult(query.session_id) ?? { status: 'pending' }
  }, { query: t.Object({ session_id: oauthId }) })
  .post('/unlink-provider', async ({ userId, body, request }) => {
    authLimiter(getClientIp(request))

    return authService.unlinkProvider(userId as number, body.provider, body.password)
  }, {
    requireAuth: true,
    body: t.Object({
      provider: t.String({ minLength: 1 }),
      password: t.Optional(t.String({ minLength: 1, maxLength: 1024 })),
    }),
  })
  .get('/me', async ({ userId, request }) => {
    if (!userId && request.headers.get('Authorization'))
      throw new AppError(401, ERROR_CODES.AUTH.INVALID_TOKEN, 'Invalid token')

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
