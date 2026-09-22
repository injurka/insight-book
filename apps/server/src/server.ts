import { corsHeadersFor, PORT } from './config'
import { withCors } from './utils/cors'
import { logger } from './utils/logger'

interface ElysiaApp {
  handle: (req: Request) => Promise<Response>
}

const IDLE_TIMEOUT = 255
const DEFAULT_MAX_REQUEST_BODY_SIZE_MB = 512
const DEFAULT_HTTP_SLOW_REQUEST_MS = 500
const configuredMaxRequestBodySizeMb = Number.parseInt(process.env.MAX_REQUEST_BODY_SIZE_MB || '', 10)
const MAX_REQUEST_BODY_SIZE_MB = configuredMaxRequestBodySizeMb > 0 && configuredMaxRequestBodySizeMb <= 1024
  ? configuredMaxRequestBodySizeMb
  : DEFAULT_MAX_REQUEST_BODY_SIZE_MB
const MAX_REQUEST_BODY_SIZE = MAX_REQUEST_BODY_SIZE_MB * 1024 * 1024
const configuredHttpSlowRequestMs = Number.parseInt(process.env.HTTP_SLOW_REQUEST_MS || '', 10)
const HTTP_SLOW_REQUEST_MS = configuredHttpSlowRequestMs >= 0
  ? configuredHttpSlowRequestMs
  : DEFAULT_HTTP_SLOW_REQUEST_MS
const LOG_ALL_HTTP_REQUESTS = process.env.HTTP_ACCESS_LOG === 'all'

function getOrigin(req: Request): string | null {
  return req.headers.get('Origin') || req.headers.get('origin')
}

function getRequestHeaders(req: Request): string | null {
  return (
    req.headers.get('access-control-request-headers')
    || req.headers.get('Access-Control-Request-Headers')
  )
}

function handlePreflight(origin: string | null, requestHeaders: string | null): Response {
  return new Response(null, {
    status: 204,
    headers: corsHeadersFor(origin, requestHeaders),
  })
}

function createFetchHandler(app: ElysiaApp) {
  return (req: Request): Response | Promise<Response> => {
    const origin = getOrigin(req)
    const requestHeaders = getRequestHeaders(req)

    if (req.method === 'OPTIONS')
      return handlePreflight(origin, requestHeaders)

    const startTime = performance.now()

    return app.handle(req).then((res) => {
      const url = new URL(req.url).pathname
      const durationMs = performance.now() - startTime

      if (!url.startsWith('/health')) {
        const fields = {
          method: req.method,
          path: url,
          status: res.status,
          duration_ms: Number(durationMs.toFixed(1)),
        }
        const shouldLog = LOG_ALL_HTTP_REQUESTS || res.status >= 400 || durationMs >= HTTP_SLOW_REQUEST_MS

        if (shouldLog) {
          if (res.status >= 500)
            logger.error(fields, '[HTTP]')
          else if (res.status >= 400)
            logger.warn(fields, '[HTTP]')
          else
            logger.info(fields, '[HTTP]')
        }
        else {
          logger.debug(fields, '[HTTP]')
        }
      }

      return withCors(res, origin, requestHeaders)
    })
  }
}

function createErrorHandler() {
  return (err: unknown): Response => {
    logger.error(err, '[Server Error]')

    return new Response('Internal Server Error', {
      status: 500,
      headers: corsHeadersFor(null),
    })
  }
}

export function createServer(app: ElysiaApp): void {
  Bun.serve({
    port: PORT,
    idleTimeout: IDLE_TIMEOUT,
    maxRequestBodySize: MAX_REQUEST_BODY_SIZE,
    fetch: createFetchHandler(app),
    error: createErrorHandler(),
  })

  logger.info(`✅ Server running on port ${PORT}`)
}
