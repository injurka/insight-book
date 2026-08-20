/* eslint-disable perfectionist/sort-imports */

// OTel инициализируется первее всех остальных импортов
import { registerRuntimeMetrics, telemetryPlugin } from './plugins/telemetry'
import './db'

import { serverTiming } from '@elysia/server-timing'
import { Elysia } from 'elysia'
import { activityRouter } from './controllers/activity.controller'
import { adminRouter } from './controllers/admin.controller'
import { authRouter, authUploadsRouter } from './controllers/auth.controller'
import { bookController, ttsController, uploadsController } from './controllers/book.controller'
import { catalogRouter } from './controllers/catalog.controller'
import { dictionaryController } from './controllers/dictionary.controller'
import { highlightRouter } from './controllers/highlight.controller'
import { llmController } from './controllers/llm.controller'
import { pushRouter } from './controllers/push.controller'
import { quizRouter } from './controllers/quiz.controller'
import { subscriptionRouter } from './controllers/subscription.controller'
import { pluginRouter } from './controllers/user-plugin.controller'
import { createServer } from './server'
import { initScheduler } from './services/scheduler.service'
import { handleElysiaError } from './utils/errors'

const app = new Elysia()
  .onError(handleElysiaError)
  .use(telemetryPlugin)
  .use(serverTiming())
  .use(bookController)
  .use(subscriptionRouter)
  .use(ttsController)
  .use(uploadsController)
  .use(authRouter)
  .use(authUploadsRouter)
  .use(activityRouter)
  .use(quizRouter)
  .use(llmController)
  .use(pushRouter)
  .use(highlightRouter)
  .use(dictionaryController)
  .use(pluginRouter)
  .use(catalogRouter)
  .use(adminRouter)
  .get('/health', () => ({ status: 'ok' }))

registerRuntimeMetrics()

createServer(app)

initScheduler()
