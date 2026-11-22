import type { Histogram, ObservableResult } from '@opentelemetry/api'
import type { App } from 'vue'
import type { Router } from 'vue-router'
import type { Metric } from 'web-vitals'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const otelMocks = vi.hoisted(() => {
  const activeSpan = {
    setAttribute: vi.fn(),
    recordException: vi.fn(),
    setStatus: vi.fn(),
    end: vi.fn(),
  }
  const routeSpan = {
    end: vi.fn(),
  }
  const logger = { emit: vi.fn() }
  const counterAdd = vi.fn()
  const histogramRecord = vi.fn()
  let clsCallback: ((result: ObservableResult) => void) | null = null
  const clsGauge = {
    addCallback: vi.fn((cb: (result: ObservableResult) => void) => {
      clsCallback = cb
    }),
  }

  const tracerProviderRegister = vi.fn()
  const tracerProviderForceFlush = vi.fn().mockResolvedValue(undefined)
  const loggerProviderForceFlush = vi.fn().mockResolvedValue(undefined)
  const metricReaderForceFlush = vi.fn().mockResolvedValue(undefined)
  const registerInstrumentations = vi.fn()
  const webVitalsHandlers = new Map<string, (metric: Metric) => void>()

  return {
    activeSpan,
    routeSpan,
    logger,
    counterAdd,
    histogramRecord,
    clsGauge,
    getClsCallback: () => clsCallback,
    resetClsCallback: () => {
      clsCallback = null
    },
    tracerProviderRegister,
    tracerProviderForceFlush,
    loggerProviderForceFlush,
    metricReaderForceFlush,
    registerInstrumentations,
    webVitalsHandlers,
    getActiveSpan: vi.fn(),
    startSpan: vi.fn(() => routeSpan),
    env: {
      API_URL: 'https://api.example.test',
      OTEL_EXPORTER_OTLP_ENDPOINT: 'https://otlp.example.test',
    },
  }
})

vi.mock('~/01.shared/lib/env', () => ({
  isTauri: false,
  get API_URL() {
    return otelMocks.env.API_URL
  },
  get OTEL_EXPORTER_OTLP_ENDPOINT() {
    return otelMocks.env.OTEL_EXPORTER_OTLP_ENDPOINT
  },
}))

vi.mock('@opentelemetry/api', () => ({
  SpanStatusCode: { ERROR: 2 },
  trace: {
    getTracer: () => ({ startSpan: otelMocks.startSpan }),
    getActiveSpan: () => otelMocks.getActiveSpan(),
  },
  metrics: {
    setGlobalMeterProvider: vi.fn(),
  },
}))

vi.mock('@opentelemetry/api-logs', () => ({
  logs: {
    getLogger: () => otelMocks.logger,
    setGlobalLoggerProvider: vi.fn(),
  },
}))

vi.mock('@opentelemetry/context-zone-peer-dep', () => ({
  ZoneContextManager: class {},
}))

vi.mock('@opentelemetry/exporter-logs-otlp-http', () => ({
  OTLPLogExporter: class {},
}))

vi.mock('@opentelemetry/exporter-metrics-otlp-http', () => ({
  AggregationTemporalityPreference: { DELTA: 1 },
  OTLPMetricExporter: class {},
}))

vi.mock('@opentelemetry/exporter-trace-otlp-http', () => ({
  OTLPTraceExporter: class {},
}))

vi.mock('@opentelemetry/instrumentation', () => ({
  registerInstrumentations: otelMocks.registerInstrumentations,
}))

vi.mock('@opentelemetry/instrumentation-document-load', () => ({
  DocumentLoadInstrumentation: class {},
}))
vi.mock('@opentelemetry/instrumentation-fetch', () => ({
  FetchInstrumentation: class {},
}))
vi.mock('@opentelemetry/instrumentation-user-interaction', () => ({
  UserInteractionInstrumentation: class {},
}))
vi.mock('@opentelemetry/instrumentation-xml-http-request', () => ({
  XMLHttpRequestInstrumentation: class {},
}))
vi.mock('@opentelemetry/resources', () => ({
  resourceFromAttributes: (attrs: Record<string, unknown>) => attrs,
}))

vi.mock('@opentelemetry/sdk-logs', () => ({
  BatchLogRecordProcessor: class {},
  LoggerProvider: class {
    forceFlush = otelMocks.loggerProviderForceFlush
  },
}))

vi.mock('@opentelemetry/sdk-metrics', () => ({
  PeriodicExportingMetricReader: class {
    forceFlush = otelMocks.metricReaderForceFlush
  },
  MeterProvider: class {
    getMeter() {
      return {
        createCounter: () => ({ add: otelMocks.counterAdd }),
        createHistogram: () => ({ record: otelMocks.histogramRecord }),
        createObservableGauge: () => otelMocks.clsGauge,
      }
    }
  },
}))

vi.mock('@opentelemetry/sdk-trace-web', () => ({
  BatchSpanProcessor: class {},
  WebTracerProvider: class {
    spanProcessors: { onStart?: (span: unknown) => void }[]
    constructor(config: { spanProcessors?: { onStart?: (span: unknown) => void }[] }) {
      this.spanProcessors = config.spanProcessors ?? []
    }

    register = otelMocks.tracerProviderRegister
    forceFlush = otelMocks.tracerProviderForceFlush
  },
}))

vi.mock('web-vitals', () => ({
  onCLS: (cb: (metric: Metric) => void) => otelMocks.webVitalsHandlers.set('CLS', cb),
  onFCP: (cb: (metric: Metric) => void) => otelMocks.webVitalsHandlers.set('FCP', cb),
  onINP: (cb: (metric: Metric) => void) => otelMocks.webVitalsHandlers.set('INP', cb),
  onLCP: (cb: (metric: Metric) => void) => otelMocks.webVitalsHandlers.set('LCP', cb),
  onTTFB: (cb: (metric: Metric) => void) => otelMocks.webVitalsHandlers.set('TTFB', cb),
}))

class FakePerformanceObserver {
  static instances: FakePerformanceObserver[] = []
  callback: PerformanceObserverCallback
  observedTypes: string[] = []

  constructor(callback: PerformanceObserverCallback) {
    this.callback = callback
    FakePerformanceObserver.instances.push(this)
  }

  observe(options: PerformanceObserverInit) {
    if (options.type)
      this.observedTypes.push(options.type)
  }

  trigger(entries: unknown[]) {
    this.callback({ getEntries: () => entries } as unknown as PerformanceObserverEntryList, this as unknown as PerformanceObserver)
  }
}

describe('monitoring service', () => {
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    otelMocks.resetClsCallback()
    otelMocks.webVitalsHandlers.clear()
    FakePerformanceObserver.instances = []
    otelMocks.env.API_URL = 'https://api.example.test'
    otelMocks.env.OTEL_EXPORTER_OTLP_ENDPOINT = 'https://otlp.example.test'
    otelMocks.getActiveSpan.mockReturnValue(undefined)
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true })
    vi.stubGlobal('PerformanceObserver', FakePerformanceObserver)
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('stays disabled when OTLP endpoint is empty and treats tracking calls as no-ops', async () => {
    otelMocks.env.OTEL_EXPORTER_OTLP_ENDPOINT = ''
    const service = await import('./monitoring.service')

    service.initMonitoring()
    service.trackEvent('book_opened', { id: 1 })
    service.trackError(new Error('ignored'))
    service.recordApiRequest({ path: '/api/books', status: 200 })
    service.recordApiError({ path: '/api/books', status: 500 })

    const app = { config: {} } as unknown as App
    const router = { afterEach: vi.fn() } as unknown as Router
    service.setupVueMonitoring(app, router)

    expect(otelMocks.tracerProviderRegister).not.toHaveBeenCalled()
    expect(otelMocks.logger.emit).not.toHaveBeenCalled()
    expect(otelMocks.counterAdd).not.toHaveBeenCalled()
    expect(router.afterEach).not.toHaveBeenCalled()
  })

  it('installs offline OTLP fetch gate, records web vitals and server-timing, and flushes on pagehide/visibilitychange', async () => {
    const baseFetch = vi.fn().mockResolvedValue(new Response('ok', { status: 200 }))
    globalThis.fetch = baseFetch as unknown as typeof fetch

    const service = await import('./monitoring.service')
    service.initMonitoring()

    expect(otelMocks.tracerProviderRegister).toHaveBeenCalledOnce()
    expect(otelMocks.registerInstrumentations).toHaveBeenCalledOnce()

    // Non-OTLP requests pass through untouched
    await globalThis.fetch('https://api.example.test/api/books')
    expect(baseFetch).toHaveBeenCalledTimes(1)

    // OTLP request while offline returns synthetic 200 without hitting network
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false })
    const offlineOtlp = await globalThis.fetch('https://otlp.example.test/v1/traces')
    expect(offlineOtlp.status).toBe(200)
    expect(baseFetch).toHaveBeenCalledTimes(1)

    // OTLP network TypeError without cause resolves synthetic 200
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true })
    baseFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    const networkFailOtlp = await globalThis.fetch('https://otlp.example.test/v1/metrics')
    expect(networkFailOtlp.status).toBe(200)

    // Non-TypeError still rejects
    baseFetch.mockRejectedValueOnce(new Error('unexpected'))
    await expect(globalThis.fetch('https://otlp.example.test/v1/logs')).rejects.toThrow('unexpected')

    // Web Vitals callbacks record metrics and deduplicate CLS gauge reports
    otelMocks.webVitalsHandlers.get('LCP')?.({ name: 'LCP', value: 1200, navigationType: 'navigate' } as Metric)
    otelMocks.webVitalsHandlers.get('INP')?.({ name: 'INP', value: 80, navigationType: 'navigate' } as Metric)
    otelMocks.webVitalsHandlers.get('TTFB')?.({ name: 'TTFB', value: 150, navigationType: 'navigate' } as Metric)
    otelMocks.webVitalsHandlers.get('FCP')?.({ name: 'FCP', value: 600, navigationType: 'navigate' } as Metric)
    otelMocks.webVitalsHandlers.get('CLS')?.({ name: 'CLS', value: 0.05, navigationType: 'navigate' } as Metric)

    const observe = vi.fn()
    otelMocks.getClsCallback()?.({ observe } as unknown as ObservableResult)
    otelMocks.getClsCallback()?.({ observe } as unknown as ObservableResult)
    expect(observe).toHaveBeenCalledTimes(1)
    expect(observe).toHaveBeenCalledWith(0.05)

    // First-input observer records FID
    const fidObserver = FakePerformanceObserver.instances.find(o => o.observedTypes.includes('first-input'))
    fidObserver?.trigger([{ startTime: 100, processingStart: 135 }])
    expect(otelMocks.histogramRecord).toHaveBeenCalledWith(35)

    // Visibility hidden and pagehide trigger telemetry flush
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' })
    document.dispatchEvent(new Event('visibilitychange'))
    window.dispatchEvent(new Event('pagehide'))

    expect(otelMocks.tracerProviderForceFlush).toHaveBeenCalledTimes(2)
    expect(otelMocks.loggerProviderForceFlush).toHaveBeenCalledTimes(2)
    expect(otelMocks.metricReaderForceFlush).toHaveBeenCalledTimes(2)
  })

  it('tracks events, errors, API telemetry, user attributes, and deduplicates already reported API errors', async () => {
    const service = await import('./monitoring.service')
    service.initMonitoring()
    otelMocks.getActiveSpan.mockReturnValue(otelMocks.activeSpan)

    service.setTelemetryUser({ id: 42, username: 'alice', role: 'admin' })

    // Normal event emits log + metric
    service.trackEvent('book_opened', { bookId: 5, meta: { a: 1 }, empty: undefined })
    expect(otelMocks.logger.emit).toHaveBeenCalledWith(expect.objectContaining({
      body: 'book_opened',
      severityText: 'INFO',
      attributes: expect.objectContaining({
        'event_name': 'book_opened',
        'enduser.id': '42',
        'enduser.username': 'alice',
        'user.role': 'admin',
        'bookId': '5',
        'meta': '{"a":1}',
      }),
    }))
    expect(otelMocks.counterAdd).toHaveBeenCalledWith(1, expect.objectContaining({ event_name: 'book_opened' }))

    // Metric-only event skips log emission
    otelMocks.logger.emit.mockClear()
    service.trackEvent('page_view')
    expect(otelMocks.logger.emit).not.toHaveBeenCalled()
    expect(otelMocks.counterAdd).toHaveBeenCalledWith(1, expect.objectContaining({ event_name: 'page_view' }))

    // Record API request redacts path and annotates active span
    service.recordApiRequest({
      method: 'post',
      path: 'https://api.example.test/api/books/123/pages/550e8400-e29b-41d4-a716-446655440000?secret=1',
      status: 200,
      transport: 'browser',
      durationMs: 42.4,
    })
    expect(otelMocks.activeSpan.setAttribute).toHaveBeenCalledWith('url.path', '/api/books/:id/pages/:id')
    expect(otelMocks.activeSpan.setAttribute).toHaveBeenCalledWith('app.feature', 'books')
    expect(otelMocks.histogramRecord).toHaveBeenCalledWith(42, expect.objectContaining({ method: 'POST', status_code: '200' }))

    // Unexpected API error records exception, log, metric, and is deduplicated in trackError
    const apiErr = new Error('Boom')
    otelMocks.logger.emit.mockClear()
    service.recordApiError({
      method: 'GET',
      path: '/api/books/1',
      status: 500,
      code: 'INTERNAL_ERR',
      transport: 'browser',
      error: apiErr,
    })
    expect(otelMocks.activeSpan.recordException).toHaveBeenCalledOnce()
    expect(otelMocks.logger.emit).toHaveBeenCalledWith(expect.objectContaining({
      body: 'api.request.error',
      severityText: 'ERROR',
    }))

    otelMocks.logger.emit.mockClear()
    service.trackError(apiErr)
    expect(otelMocks.logger.emit).not.toHaveBeenCalled()

    // Expected timeout API error emits WARN log with timeout metadata
    service.recordApiError({
      method: 'GET',
      path: '/api/dictionary',
      reason: 'timeout',
      timeoutMs: 20_000,
      expected: true,
      error: new Error('timed out'),
    })
    expect(otelMocks.logger.emit).toHaveBeenCalledWith(expect.objectContaining({
      body: 'api.request.error',
      severityText: 'WARN',
      attributes: expect.objectContaining({
        'api.error_reason': 'timeout',
        'api.timeout_ms': 20_000,
      }),
    }))

    // Reset user and track non-Error value
    service.resetTelemetryUser()
    service.trackError('raw error message', { source: 'test' })
    expect(otelMocks.logger.emit).toHaveBeenLastCalledWith(expect.objectContaining({
      body: 'Error: raw error message',
      severityText: 'ERROR',
      attributes: { source: 'test' },
    }))
  })

  it('wires Vue errorHandler, router afterEach spans, and Server-Timing observer', async () => {
    const service = await import('./monitoring.service')
    service.initMonitoring()

    const originalErrorHandler = vi.fn()
    const app = { config: { errorHandler: originalErrorHandler } } as unknown as App
    let afterEachCb: ((to: { name?: string, path: string, fullPath: string }) => void) | undefined
    const router = {
      afterEach: vi.fn((cb: (to: { name?: string, path: string, fullPath: string }) => void) => {
        afterEachCb = cb
      }),
    } as unknown as Router

    service.setupVueMonitoring(app, router)

    const vueErr = new Error('render crash')
    app.config.errorHandler?.(vueErr, { $options: { name: 'ReaderPage' } } as never, 'render')
    expect(originalErrorHandler).toHaveBeenCalledWith(vueErr, expect.anything(), 'render')
    expect(otelMocks.logger.emit).toHaveBeenCalledWith(expect.objectContaining({
      body: 'Error: render crash',
      attributes: expect.objectContaining({ vue_component: 'ReaderPage', vue_info: 'render' }),
    }))

    afterEachCb?.({ name: 'reader', path: '/reader/1', fullPath: '/reader/1?p=2' })
    expect(otelMocks.startSpan).toHaveBeenCalledWith('routeChange', {
      attributes: { 'view.name': 'reader', 'page.url': '/reader/1?p=2' },
    })
    expect(otelMocks.routeSpan.end).toHaveBeenCalledOnce()

    // Server-Timing observer records only API URLs with serverTiming entries
    const customHistogram = { record: vi.fn() } as unknown as Histogram
    service.setupServerTimingObserver(customHistogram)
    const serverTimingObserver = FakePerformanceObserver.instances.at(-1)
    serverTimingObserver?.trigger([
      {
        name: 'https://other.example.test/asset.js',
        entryType: 'resource',
        serverTiming: [{ name: 'db', duration: 10 }],
      },
      {
        name: 'https://api.example.test/api/books',
        entryType: 'resource',
        serverTiming: [],
      },
      {
        name: 'https://api.example.test/api/books',
        entryType: 'resource',
        serverTiming: [{ name: 'db', duration: 12.5 }],
      },
    ])

    expect(customHistogram.record).toHaveBeenCalledTimes(1)
    expect(customHistogram.record).toHaveBeenCalledWith(12.5, {
      metric: 'db',
      url: 'https://api.example.test/api/books',
      entry_type: 'resource',
    })
  })
})
