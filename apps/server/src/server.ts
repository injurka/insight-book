import { corsHeadersFor, PORT } from './config'
import { withCors } from './utils/cors'
import { logger } from './utils/logger'

interface ElysiaApp {
  handle: (req: Request) => Promise<Response>
}

const IDLE_TIMEOUT = 255
const MAX_REQUEST_BODY_SIZE = 5000 * 1024 * 1024

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
      const duration = (performance.now() - startTime).toFixed(1)

      if (!url.startsWith('/health')) {
        logger.info(`[HTTP] ${req.method} ${url} ${res.status} - ${duration}ms`)
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
