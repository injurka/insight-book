/* eslint-disable no-console */
import { Elysia } from 'elysia'
import { PORT } from './config'

import { activityRouter } from './controllers/activity.controller'
import { authRouter, authUploadsRouter } from './controllers/auth.controller'
import { bookController, ttsController, uploadsController } from './controllers/book.controller'
import { dictionaryController } from './controllers/dictionary.controller'
import { highlightRouter } from './controllers/highlight.controller'
import { pushRouter } from './controllers/push.controller'
import { quizRouter } from './controllers/quiz.controller'

import { initScheduler } from './services/scheduler.service'
import { withCors } from './utils/cors'
import { corsOk } from './utils/helpers'

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
  .get('/health', () => ({ status: 'ok' }))

Bun.serve({
  port: PORT,
  idleTimeout: 255,
  maxRequestBodySize: 5000 * 1024 * 1024,
  fetch(req) {
    if (req.method === 'OPTIONS')
      return corsOk()
    return app.handle(req).then(withCors)
  },
  error(err: unknown) {
    console.error('[Server Error]', err)
    return withCors(new Response('Internal Server Error', { status: 500 }))
  },
})

console.log(`✅ Server running on port ${PORT}`)

initScheduler()
