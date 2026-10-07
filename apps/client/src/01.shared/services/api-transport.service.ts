import type { Span } from '@opentelemetry/api'
import type { UploadProgress } from '~/01.shared/types/models'
import { context, propagation, SpanKind, SpanStatusCode, trace } from '@opentelemetry/api'
import { fetch as tauriFetch } from '@tauri-apps/plugin-http'
import { isTauri } from '~/01.shared/lib/env'
import { recordApiRequest } from '~/01.shared/services/monitoring.service'

const SERVICE_NAME = 'insight-book-client'
const FALLBACK_BASE_URL = 'http://localhost'

type FetchTransport = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>

interface FetchOptionsWithUploadProgress extends RequestInit {
  onUploadProgress?: (progress: UploadProgress) => void
  timeout?: number
}

interface TransportUrl {
  path: string
  host: string
}

/**
 * Keep request telemetry useful without putting query values, credentials or
 * request bodies into spans. Path segments which look like IDs are redacted,
 * while the stable API part remains available for grouping in SigNoz.
 */
export function getSafeTransportUrl(input: RequestInfo | URL): TransportUrl {
  const rawUrl = typeof Request !== 'undefined' && input instanceof Request
    ? input.url
    : input instanceof URL
      ? input.href
      : String(input)

  let url: URL
  try {
    const baseUrl = typeof globalThis.location !== 'undefined'
      ? globalThis.location.origin
      : FALLBACK_BASE_URL
    url = new URL(rawUrl, baseUrl)
  }
  catch {
    return { path: '[invalid-url]', host: '' }
  }

  const path = url.pathname
    .split('/')
    .map((segment) => {
      if (!segment)
        return segment

      // IDs, UUIDs, encoded values and very long user-supplied values should
      // not become telemetry attributes. Keep ordinary endpoint names intact.
      if (/^\d+$/.test(segment)
        || /^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(segment)
        || /%[0-9a-f]{2}/i.test(segment)
        || segment.length > 40) {
        return ':param'
      }

      return segment
    })
    .join('/')

  return {
    path,
    host: url.host,
  }
}

function requestMethod(input: RequestInfo | URL, init?: RequestInit): string {
  return (init?.method || (typeof Request !== 'undefined' && input instanceof Request ? input.method : 'GET')).toUpperCase()
}

function errorType(error: unknown): string {
  if (error instanceof Error && error.name)
    return error.name

  return typeof error
}

function setHeader(carrier: Headers, key: string, value: string | number | boolean): void {
  carrier.set(key, String(value))
}

function finishSpan(
  span: Span,
  startedAt: number,
  status?: number,
  error?: unknown,
): void {
  const duration = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - startedAt
  span.setAttribute('http.request.duration_ms', Math.max(0, duration))

  if (status !== undefined) {
    span.setAttribute('http.response.status_code', status)
    span.setAttribute('http.status_code', status)
    if (status >= 400) {
      span.setAttribute('error.type', 'HTTPError')
      span.setAttribute('error.code', String(status))
      span.setStatus({ code: SpanStatusCode.ERROR })
    }
  }
  else if (error !== undefined) {
    span.setAttribute('error.type', errorType(error))
    span.setStatus({ code: SpanStatusCode.ERROR })
  }

  span.end()
}

function elapsedMs(startedAt: number): number {
  const now = typeof performance !== 'undefined' ? performance.now() : Date.now()

  return Math.max(0, now - startedAt)
}

function createTauriSpan(tracer: ReturnType<typeof trace.getTracer>, method: string, safeUrl: TransportUrl): Span | null {
  if (!isTauri)
    return null

  return tracer.startSpan(`HTTP ${method}`, {
    kind: SpanKind.CLIENT,
    attributes: {
      'http.request.method': method,
      'url.path': safeUrl.path,
      'server.address': safeUrl.host,
      'app.transport': 'tauri',
      'api.transport': 'tauri',
    },
  })
}

function createRequestHeaders(input: RequestInfo | URL, init?: RequestInit): Headers {
  const headers = new Headers(typeof Request !== 'undefined' && input instanceof Request ? input.headers : undefined)
  if (init?.headers) {
    new Headers(init.headers).forEach((value, key) => headers.set(key, value))
  }

  return headers
}

function createXhrResponse(xhr: XMLHttpRequest): Response {
  const headers = new Headers()
  const rawHeaders = xhr.getAllResponseHeaders()

  for (const line of rawHeaders.trim().split(/[\r\n]+/)) {
    const separator = line.indexOf(':')
    if (separator > 0)
      headers.append(line.slice(0, separator).trim(), line.slice(separator + 1).trim())
  }

  return new Response(xhr.responseText, {
    status: xhr.status,
    statusText: xhr.statusText,
    headers,
  })
}

function xhrFetch(
  input: RequestInfo | URL,
  init: RequestInit,
  timeout: number | undefined,
  onUploadProgress: (progress: UploadProgress) => void,
): Promise<Response> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    const signal = init.signal
    let settled = false
    let abortFromSignal = () => undefined

    const cleanup = () => signal?.removeEventListener('abort', abortFromSignal)
    const fail = (error: unknown) => {
      if (settled)
        return

      settled = true
      cleanup()
      reject(error)
    }

    abortFromSignal = () => {
      const reason = signal?.reason
      fail(reason instanceof Error ? reason : new DOMException('The request was aborted', 'AbortError'))
      xhr.abort()
    }

    if (signal?.aborted) {
      abortFromSignal()

      return
    }

    xhr.open(requestMethod(input, init), input instanceof Request ? input.url : String(input))
    xhr.responseType = 'text'
    if (timeout)
      xhr.timeout = timeout

    const headers = createRequestHeaders(input, init)
    headers.forEach((value, key) => xhr.setRequestHeader(key, value))

    signal?.addEventListener('abort', abortFromSignal, { once: true })
    xhr.upload.addEventListener('progress', (event) => {
      onUploadProgress({ loaded: event.loaded, total: event.lengthComputable ? event.total : 0 })
    })
    xhr.addEventListener('load', () => {
      if (settled)
        return

      if (xhr.status === 0) {
        fail(new TypeError('Failed to fetch'))

        return
      }

      settled = true
      cleanup()
      resolve(createXhrResponse(xhr))
    }, { once: true })
    xhr.addEventListener('error', () => fail(new TypeError('Failed to fetch')), { once: true })
    xhr.addEventListener('timeout', () => fail(new DOMException('The request timed out', 'TimeoutError')), { once: true })
    xhr.addEventListener('abort', () => fail(new DOMException('The request was aborted', 'AbortError')), { once: true })

    xhr.send(init.body as XMLHttpRequestBodyInit | Document | null)
  })
}

function recordCompletedRequest(
  method: string,
  safeUrl: TransportUrl,
  startedAt: number,
  status?: number,
): void {
  recordApiRequest({
    method,
    path: safeUrl.path,
    status,
    transport: isTauri ? 'tauri' : 'browser',
    durationMs: elapsedMs(startedAt),
  })
}

/**
 * Creates the fetch implementation used by ofetch in both browser and Tauri.
 * A manual client span is required for Tauri's Rust-backed HTTP client, which
 * is not seen by the browser FetchInstrumentation. The same wrapper keeps
 * browser and mobile traces/attributes consistent.
 */
export function createApiFetch(): typeof globalThis.fetch {
  const tauriTransport: FetchTransport | null = isTauri
    ? (tauriFetch as unknown as FetchTransport)
    : null

  const tracer = trace.getTracer(SERVICE_NAME)

  return (async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const method = requestMethod(input, init)
    const safeUrl = getSafeTransportUrl(input)
    const span = createTauriSpan(tracer, method, safeUrl)
    const spanContext = span ? trace.setSpan(context.active(), span) : context.active()
    const startedAt = typeof performance !== 'undefined' ? performance.now() : Date.now()

    // Create a fresh carrier so Authorization and other caller headers are
    // preserved for the request but never copied into telemetry attributes.
    const fetchOptions = init as FetchOptionsWithUploadProgress | undefined
    const { onUploadProgress, timeout, ...standardOptions } = fetchOptions || {}
    const headers = createRequestHeaders(input, init)

    if (span)
      propagation.inject(spanContext, headers, { set: setHeader })
    const requestInit: RequestInit = { ...standardOptions, headers }

    try {
      const response = await context.with(spanContext, () => {
        if (tauriTransport)
          return tauriTransport(input, requestInit)

        if (onUploadProgress) {
          return xhrFetch(
            input,
            requestInit,
            timeout,
            onUploadProgress,
          )
        }

        return globalThis.fetch(input, requestInit)
      })
      if (span)
        finishSpan(span, startedAt, response.status)
      recordCompletedRequest(
        method,
        safeUrl,
        startedAt,
        response.status,
      )

      return response
    }
    catch (error) {
      if (span) {
        finishSpan(
          span,
          startedAt,
          undefined,
          error,
        )
      }

      recordCompletedRequest(method, safeUrl, startedAt)
      throw error
    }
  }) as typeof globalThis.fetch
}
