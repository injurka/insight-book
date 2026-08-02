import { Elysia } from 'elysia'
import { corsHeadersFor, PORT } from './config'

import { activityRouter } from './controllers/activity.controller'
import { authRouter, authUploadsRouter } from './controllers/auth.controller'
import { bookController, ttsController, uploadsController } from './controllers/book.controller'
import { catalogRouter } from './controllers/catalog.controller'
import { dictionaryController } from './controllers/dictionary.controller'
import { highlightRouter } from './controllers/highlight.controller'
import { pushRouter } from './controllers/push.controller'
import { quizRouter } from './controllers/quiz.controller'
import { pluginRouter } from './controllers/user-plugin.controller'

import { initScheduler } from './services/scheduler.service'
import { withCors } from './utils/cors'
import { logger } from './utils/logger'

import './db'

const app = new Elysia()
  .use(bookController)
  .use(ttsController)
  .use(uploadsController)
  .use(authRouter)
  .use(authUploadsRouter)
  .use(activityRouter)
  .use(quizRouter)
  .use(pushRouter)
  .use(highlightRouter)
  .use(dictionaryController)
  .use(pluginRouter)
  .use(catalogRouter)
  .get('/health', () => ({ status: 'ok' }))

Bun.serve({
  port: PORT,
  idleTimeout: 255,
  maxRequestBodySize: 5000 * 1024 * 1024,
  fetch(req) {
    const origin = req.headers.get('Origin') || req.headers.get('origin')

    if (req.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeadersFor(origin),
      })
    }

    return app.handle(req).then(res => withCors(res, origin))
  },
  error(err: unknown) {
    logger.error(err, '[Server Error]')
    return new Response('Internal Server Error', {
      status: 500,
      headers: corsHeadersFor(null),
    })
  },
})

logger.info(`✅ Server running on port ${PORT}`)

initScheduler()
