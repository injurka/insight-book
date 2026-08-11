import { Elysia, t } from 'elysia'
import jwt from 'jsonwebtoken'
import { AUTH_MODE, JWT_SECRET } from '../config'
import { ERROR_CODES } from '../constants/error-codes'
import { activityService } from '../services/activity.service'
import { cachePlugin } from '../utils/cache'
import { AppError, handleElysiaError } from '../utils/errors'

const authPlugin = new Elysia({ name: 'activity-auth' })
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

export const activityRouter = new Elysia({ prefix: '/api/activity' })
  .use(authPlugin)
  .use(cachePlugin)
  .onError(handleElysiaError)
  .get('/stats', async ({ userId }) => {
    return await activityService.getActivityStats(userId!)
  }, { requireAuth: true, cache: 'shortPrivate' })
  .get('/tokens', async ({ userId, query }) => {
    return await activityService.getTokenUsage(userId!, query.period)
  }, {
    requireAuth: true,
    cache: 'shortPrivate',
    query: t.Object({
      period: t.Optional(t.String()),
    }),
  })
