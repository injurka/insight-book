import { serverTiming } from '@elysia/server-timing'
import { opentelemetry } from '@elysiajs/opentelemetry'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto'
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-node'
import { Elysia } from 'elysia'
import { corsHeadersFor, OTEL_EXPORTER_OTLP_ENDPOINT, PORT } from './config'

import { activityRouter } from './controllers/activity.controller'
import { adminRouter } from './controllers/admin.controller'
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
import { handleElysiaError } from './utils/errors'
import { logger } from './utils/logger'

import './db'

const app = new Elysia()
  .onError(handleElysiaError)
  .use(
    opentelemetry({
      spanProcessors: [
        new BatchSpanProcessor(
          new OTLPTraceExporter({
            url: OTEL_EXPORTER_OTLP_ENDPOINT,
          }),
        ),
      ],
    }),
  )
  .use(serverTiming())
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
  .use(adminRouter)
  .get('/health', () => ({ status: 'ok' }))

Bun.serve({
  port: PORT,
  idleTimeout: 255,
  maxRequestBodySize: 5000 * 1024 * 1024,
  fetch(req) {
    const origin = req.headers.get('Origin') || req.headers.get('origin')

    const requestHeaders = req.headers.get('access-control-request-headers') || req.headers.get('Access-Control-Request-Headers')

    if (req.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeadersFor(origin, requestHeaders),
      })
    }

    const startTime = performance.now()
    return app.handle(req).then((res) => {
      const duration = (performance.now() - startTime).toFixed(1)
      const url = new URL(req.url).pathname
      if (!url.startsWith('/health')) {
        logger.info(`[HTTP] ${req.method} ${url} ${res.status} - ${duration}ms`)
      }
      return withCors(res, origin, requestHeaders)
    })
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
