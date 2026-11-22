import { SpanStatusCode, trace } from '@opentelemetry/api'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const tauriFetchMock = vi.hoisted(() => vi.fn())
const recordApiRequestMock = vi.hoisted(() => vi.fn())
const envState = vi.hoisted(() => ({ isTauri: false }))

vi.mock('@tauri-apps/plugin-http', () => ({
  fetch: tauriFetchMock,
}))

vi.mock('~/01.shared/lib/env', () => ({
  get isTauri() {
    return envState.isTauri
  },
}))

vi.mock('~/01.shared/services/monitoring.service', () => ({
  recordApiRequest: recordApiRequestMock,
}))

interface FakeXhrEvent {
  loaded?: number
  total?: number
  lengthComputable?: boolean
}

class FakeXMLHttpRequest {
  static instances: FakeXhrEventTarget[] = []
  method = ''
  url = ''
  responseType = ''
  timeout = 0
  status = 200
  statusText = 'OK'
  responseText = '{"ok":true}'
  responseHeaders = 'content-type: application/json\r\nx-request-id: req-1\r\n'
  requestHeaders = new Map<string, string>()
  sentBody: unknown = null
  aborted = false
  listeners = new Map<string, ((event: FakeXhrEvent) => void)[]>()
  uploadListeners = new Map<string, ((event: FakeXhrEvent) => void)[]>()
  upload = {
    addEventListener: (type: string, cb: (event: FakeXhrEvent) => void) => {
      const list = this.uploadListeners.get(type) ?? []
      list.push(cb)
      this.uploadListeners.set(type, list)
    },
  }

  constructor() {
    FakeXMLHttpRequest.instances.push(this)
  }

  open(method: string, url: string) {
    this.method = method
    this.url = url
  }

  setRequestHeader(key: string, value: string) {
    this.requestHeaders.set(key.toLowerCase(), value)
  }

  getAllResponseHeaders() {
    return this.responseHeaders
  }

  addEventListener(type: string, cb: (event: FakeXhrEvent) => void) {
    const list = this.listeners.get(type) ?? []
    list.push(cb)
    this.listeners.set(type, list)
  }

  send(body: unknown) {
    this.sentBody = body
  }

  abort() {
    this.aborted = true
  }

  emit(type: string, event: FakeXhrEvent = {}) {
    for (const cb of this.listeners.get(type) ?? [])
      cb(event)
  }

  emitUpload(type: string, event: FakeXhrEvent = {}) {
    for (const cb of this.uploadListeners.get(type) ?? [])
      cb(event)
  }
}

type FakeXhrEventTarget = FakeXMLHttpRequest

describe('api transport telemetry', () => {
  beforeEach(() => {
    envState.isTauri = false
    FakeXMLHttpRequest.instances = []
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('redacts query strings, encoded values, long segments, and identifier-like path segments', async () => {
    const { getSafeTransportUrl } = await import('./api-transport.service')

    const safeUrl = getSafeTransportUrl('https://api.example.test/api/books/123/pages/550e8400-e29b-41d4-a716-446655440000?token=secret')
    expect(safeUrl.path).toBe('/api/books/:param/pages/:param')
    expect(safeUrl.host).toBe('api.example.test')

    const encodedAndLong = getSafeTransportUrl(new URL(`https://api.example.test/api/words/hello%20world/${'a'.repeat(45)}`))
    expect(encodedAndLong.path).toBe('/api/words/:param/:param')

    const reqUrl = getSafeTransportUrl(new Request('https://api.example.test/api/auth/me?foo=bar'))
    expect(reqUrl).toEqual({ path: '/api/auth/me', host: 'api.example.test' })

    expect(getSafeTransportUrl('http://[::1')).toEqual({ path: '[invalid-url]', host: '' })
  })

  it('resolves the browser fetch implementation at request time and records telemetry', async () => {
    const { createApiFetch } = await import('./api-transport.service')
    const initialFetch = vi.fn().mockResolvedValue(new Response(null, { status: 204 }))
    const currentFetch = vi.fn().mockResolvedValue(new Response(null, { status: 200 }))
    vi.stubGlobal('fetch', initialFetch)

    const apiFetch = createApiFetch()
    vi.stubGlobal('fetch', currentFetch)

    await apiFetch('https://api.example.test/api/auth/me')

    expect(initialFetch).not.toHaveBeenCalled()
    expect(currentFetch).toHaveBeenCalledOnce()
    expect(recordApiRequestMock).toHaveBeenCalledWith(expect.objectContaining({
      method: 'GET',
      path: '/api/auth/me',
      status: 200,
      transport: 'browser',
    }))
  })

  it('uses XMLHttpRequest when onUploadProgress is passed and reports progress, headers, and errors', async () => {
    vi.stubGlobal('XMLHttpRequest', FakeXMLHttpRequest)
    const { createApiFetch } = await import('./api-transport.service')
    const apiFetch = createApiFetch()

    const progressEvents: { loaded: number, total: number }[] = []
    const promise = apiFetch('https://api.example.test/api/catalog/plugins/upload', {
      method: 'POST',
      headers: { Authorization: 'Bearer tok' },
      body: 'payload',
      timeout: 5000,
      onUploadProgress: p => progressEvents.push(p),
    } as RequestInit)

    const xhr = FakeXMLHttpRequest.instances[0]
    expect(xhr.method).toBe('POST')
    expect(xhr.timeout).toBe(5000)
    expect(xhr.requestHeaders.get('authorization')).toBe('Bearer tok')

    xhr.emitUpload('progress', { loaded: 50, total: 100, lengthComputable: true })
    xhr.emitUpload('progress', { loaded: 75, total: 100, lengthComputable: false })
    xhr.emit('load')

    const response = await promise
    expect(response.status).toBe(200)
    expect(response.headers.get('x-request-id')).toBe('req-1')
    expect(await response.text()).toBe('{"ok":true}')
    expect(progressEvents).toEqual([
      { loaded: 50, total: 100 },
      { loaded: 75, total: 0 },
    ])

    // Status 0 -> network failure
    const statusZeroPromise = apiFetch('https://api.example.test/api/upload', {
      method: 'POST',
      onUploadProgress: vi.fn(),
    } as RequestInit)
    const xhrZero = FakeXMLHttpRequest.instances[1]
    xhrZero.status = 0
    xhrZero.emit('load')
    await expect(statusZeroPromise).rejects.toThrow('Failed to fetch')

    // Timeout and error events
    const timeoutPromise = apiFetch('https://api.example.test/api/upload', {
      method: 'POST',
      onUploadProgress: vi.fn(),
    } as RequestInit)
    FakeXMLHttpRequest.instances[2].emit('timeout')
    await expect(timeoutPromise).rejects.toMatchObject({ name: 'TimeoutError' })

    const errorPromise = apiFetch('https://api.example.test/api/upload', {
      method: 'POST',
      onUploadProgress: vi.fn(),
    } as RequestInit)
    FakeXMLHttpRequest.instances[3].emit('error')
    await expect(errorPromise).rejects.toThrow('Failed to fetch')

    // Pre-aborted and mid-flight AbortSignal
    const preAborted = new AbortController()
    preAborted.abort(new Error('cancelled early'))
    await expect(apiFetch('https://api.example.test/api/upload', {
      method: 'POST',
      signal: preAborted.signal,
      onUploadProgress: vi.fn(),
    } as RequestInit)).rejects.toThrow('cancelled early')

    const midFlight = new AbortController()
    const abortPromise = apiFetch('https://api.example.test/api/upload', {
      method: 'POST',
      signal: midFlight.signal,
      onUploadProgress: vi.fn(),
    } as RequestInit)
    midFlight.abort()
    await expect(abortPromise).rejects.toMatchObject({ name: 'AbortError' })
    expect(FakeXMLHttpRequest.instances.at(-1)?.aborted).toBe(true)
  })

  it('uses Tauri transport with manual OTel client spans for success, HTTP errors, and exceptions', async () => {
    envState.isTauri = true
    const span = {
      setAttribute: vi.fn(),
      setStatus: vi.fn(),
      end: vi.fn(),
      spanContext: () => ({ traceId: '1', spanId: '2', traceFlags: 1 }),
    }
    const startSpan = vi.fn().mockReturnValue(span)
    vi.spyOn(trace, 'getTracer').mockReturnValue({ startSpan } as unknown as ReturnType<typeof trace.getTracer>)

    const { createApiFetch } = await import('./api-transport.service')
    const apiFetch = createApiFetch()

    tauriFetchMock.mockResolvedValueOnce(new Response('ok', { status: 200 }))
    const okRes = await apiFetch('https://api.example.test/api/books/10', { method: 'GET' })
    expect(okRes.status).toBe(200)
    expect(startSpan).toHaveBeenCalledWith('HTTP GET', expect.objectContaining({
      attributes: expect.objectContaining({
        'http.request.method': 'GET',
        'url.path': '/api/books/:param',
        'api.transport': 'tauri',
      }),
    }))
    expect(span.setAttribute).toHaveBeenCalledWith('http.response.status_code', 200)
    expect(span.end).toHaveBeenCalledTimes(1)

    // HTTP >= 400 marks span with HTTPError
    tauriFetchMock.mockResolvedValueOnce(new Response('err', { status: 500 }))
    const errRes = await apiFetch('https://api.example.test/api/books/10', { method: 'POST' })
    expect(errRes.status).toBe(500)
    expect(span.setAttribute).toHaveBeenCalledWith('error.type', 'HTTPError')
    expect(span.setAttribute).toHaveBeenCalledWith('error.code', '500')
    expect(span.setStatus).toHaveBeenCalledWith({ code: SpanStatusCode.ERROR })

    // Transport exception records error type and rethrows
    tauriFetchMock.mockRejectedValueOnce(new TypeError('offline'))
    await expect(apiFetch('https://api.example.test/api/books/10')).rejects.toThrow('offline')
    expect(span.setAttribute).toHaveBeenCalledWith('error.type', 'TypeError')
    expect(recordApiRequestMock).toHaveBeenLastCalledWith(expect.objectContaining({
      path: '/api/books/:param',
      status: undefined,
      transport: 'tauri',
    }))
  })

  it('enforces timeout even when a caller AbortSignal is provided', async () => {
    vi.useFakeTimers()

    try {
      const { createApiFetch } = await import('./api-transport.service')
      const callerController = new AbortController()
      const hungFetch = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          reject(new DOMException('The request was aborted', 'AbortError'))
        }, { once: true })
      }))
      vi.stubGlobal('fetch', hungFetch)

      const apiFetch = createApiFetch()
      const pending = apiFetch('https://api.example.test/api/books', {
        signal: callerController.signal,
        timeout: 500,
      } as RequestInit)
      const assertion = expect(pending).rejects.toMatchObject({ name: 'TimeoutError' })

      await vi.advanceTimersByTimeAsync(500)
      await assertion
      expect(callerController.signal.aborted).toBe(false)
      expect(vi.getTimerCount()).toBe(0)
    }
    finally {
      vi.useRealTimers()
    }
  })

  it('forwards caller cancellation as AbortError and clears the timeout timer', async () => {
    vi.useFakeTimers()

    try {
      const { createApiFetch } = await import('./api-transport.service')
      const callerController = new AbortController()
      const hungFetch = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          reject(new DOMException('The request was aborted', 'AbortError'))
        }, { once: true })
      }))
      vi.stubGlobal('fetch', hungFetch)

      const apiFetch = createApiFetch()
      const pending = apiFetch('https://api.example.test/api/books', {
        signal: callerController.signal,
        timeout: 10_000,
      } as RequestInit)
      const assertion = expect(pending).rejects.toMatchObject({ name: 'AbortError' })

      callerController.abort()
      await assertion
      expect(vi.getTimerCount()).toBe(0)
    }
    finally {
      vi.useRealTimers()
    }
  })

  it('immediately aborts when given an already-aborted caller signal', async () => {
    vi.useFakeTimers()

    try {
      const { createApiFetch } = await import('./api-transport.service')
      const callerController = new AbortController()
      callerController.abort()

      const checkedFetch = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
        expect(init?.signal?.aborted).toBe(true)
        throw new DOMException('The request was aborted', 'AbortError')
      })
      vi.stubGlobal('fetch', checkedFetch)

      const apiFetch = createApiFetch()
      await expect(apiFetch('https://api.example.test/api/books', {
        signal: callerController.signal,
        timeout: 10_000,
      } as RequestInit)).rejects.toMatchObject({ name: 'AbortError' })
      expect(vi.getTimerCount()).toBe(0)
    }
    finally {
      vi.useRealTimers()
    }
  })
})
