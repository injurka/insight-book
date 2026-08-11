import { Elysia, t } from 'elysia'
import jwt from 'jsonwebtoken'
import { AUTH_MODE, JWT_SECRET } from '../config'
import { ERROR_CODES } from '../constants/error-codes'
import { pushService } from '../services/push.service'
import { AppError, handleElysiaError } from '../utils/errors'

export const authPlugin = new Elysia().derive({ as: 'scoped' }, ({ headers }) => {
  if (AUTH_MODE === 'single')
    return { userId: 1 }
  const authHeader = headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer '))
    throw new AppError(401, ERROR_CODES.AUTH.UNAUTHORIZED, 'Unauthorized')
  const token = authHeader.split(' ')[1]
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: number }
    return { userId: decoded.userId }
  }
  catch {
    throw new AppError(401, ERROR_CODES.AUTH.INVALID_TOKEN, 'Invalid token')
  }
})

export const pushRouter = new Elysia({ prefix: '/api/push' })
  .use(authPlugin)
  .onError(handleElysiaError)
  .get('/vapid-public-key', async () => {
    return pushService.getVapidKey()
  })
  .post('/subscribe', async ({ body, userId }) => {
    return pushService.subscribeWebPush(userId, body.endpoint, body.keys)
  }, {
    body: t.Object({
      endpoint: t.String(),
      keys: t.Any(),
    }),
  })
  .post('/unsubscribe', async ({ body, userId }) => {
    return pushService.unsubscribeWebPush(userId, body.endpoint || '')
  }, {
    body: t.Object({
      endpoint: t.Optional(t.String()),
    }),
  })
  .put('/settings', async ({ userId, body }) => {
    const targetDeckId = body.targetDeckId === 'all'
      ? 'all'
      : (typeof body.targetDeckId === 'number'
          ? body.targetDeckId
          : (body.targetDeckId ? Number(body.targetDeckId) : undefined))

    return pushService.updatePushSettings(userId, {
      ...body,
      targetDeckId,
    })
  }, {
    body: t.Object({
      targetDeckId: t.Optional(t.Union([t.String(), t.Number()])),
      timeStart: t.Optional(t.String()),
      timeEnd: t.Optional(t.String()),
      timezone: t.Optional(t.String()),
      uiLanguage: t.Optional(t.String()),
      pushCount: t.Optional(t.Number()),
    }),
  })
