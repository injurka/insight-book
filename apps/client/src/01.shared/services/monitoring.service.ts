import type { Attributes, Counter, Histogram, ObservableGauge, Span } from '@opentelemetry/api'
import type { Logger } from '@opentelemetry/api-logs'
import type { SpanProcessor } from '@opentelemetry/sdk-trace-web'
import type { App } from 'vue'
import type { Router } from 'vue-router'
import type { Metric } from 'web-vitals'
import { metrics, SpanStatusCode, trace } from '@opentelemetry/api'
import { logs } from '@opentelemetry/api-logs'
import { ZoneContextManager } from '@opentelemetry/context-zone-peer-dep'
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http'
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http'
import { registerInstrumentations } from '@opentelemetry/instrumentation'
import { DocumentLoadInstrumentation } from '@opentelemetry/instrumentation-document-load'
import { FetchInstrumentation } from '@opentelemetry/instrumentation-fetch'
import { UserInteractionInstrumentation } from '@opentelemetry/instrumentation-user-interaction'
import { XMLHttpRequestInstrumentation } from '@opentelemetry/instrumentation-xml-http-request'
import { resourceFromAttributes } from '@opentelemetry/resources'
import { BatchLogRecordProcessor, LoggerProvider } from '@opentelemetry/sdk-logs'
import { MeterProvider, PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics'
import { BatchSpanProcessor, WebTracerProvider } from '@opentelemetry/sdk-trace-web'
import { onCLS, onFCP, onINP, onLCP, onTTFB } from 'web-vitals'
import { API_URL, OTEL_EXPORTER_OTLP_ENDPOINT } from '~/01.shared/lib/env'
import packageJson from '../../../package.json'

export type TelemetryEventName
  = | 'theme_changed'
    | 'custom_llm_enabled'
    | 'tts_speed_changed'
    | 'reader_font_size_changed'
    | 'reader_font_family_changed'
    | 'manga_ocr_mode_changed'
    | 'app_language_changed'
    | 'pwa_installed'
    | 'tts_played'
    | 'ai_analyze'
    | 'page_analysis_started'
    | 'ai_translation_requested'
    | 'ai_word_lookup'
    | 'word_saved_to_dict'
    | 'word_removed_from_dict'
    | 'logout'
    | 'login_success'
    | 'register_success'
    | 'app_error'
    | 'anki_export_downloaded'
    | 'deck_created'
    | 'deck_updated'
    | 'deck_deleted'
    | 'bulk_words_deleted'
    | 'bulk_words_moved'
    | 'book_sync_started'
    | 'public_book_search'
    | 'public_book_downloaded'
    | 'book_full_analysis_started'
    | 'vocabulary_analysis_started'
    | 'book_uploaded'
    | 'custom_manga_created'
    | 'book_deleted'
    | 'reading_session_ended'
    | 'parallel_view_toggled'
    | 'toc_opened'
    | 'page_loaded'
    | 'book_opened'
    | 'srs_training_started'
    | 'srs_training_finished'
    | 'page_view'
    | (string & {})

const SERVICE_NAME = 'insight-book-client'

// Severity по OTel Log Data Model: INFO = 9, ERROR = 17
const SEVERITY_INFO = 9
const SEVERITY_ERROR = 17

const tracer = trace.getTracer(SERVICE_NAME, packageJson.version)

let otelLogger: Logger = logs.getLogger(SERVICE_NAME)
let enabled = false

let eventCounter: Counter | null = null
let errorCounter: Counter | null = null

/**
 * Оффлайн-гейт для OTLP-экспортёров.
 *
 * При отсутствии сети FetchTransport (otlp-exporter-base) возвращает retryable-ошибку,
 * поверх которой RetryingTransport делает до 5 попыток с бэкоффом (1s→1.5s→…).
 * Три экспортёра (traces/metrics/logs) с периодичностью 5s каждый цикл дают в Network
 * «бесконечный» поток POST на /v1/{traces|metrics} при выключенном интернете.
 *
 * Обёртка перехватывает fetch до того, как транспорт его захватит (транспорт читает
 * `globalThis.fetch` в момент send), и для OTLP-эндпоинтов:
 *  - если браузер оффлайн (navigator.onLine === false) — мгновенно резолвит притворный
 *    2xx-ответ, RetryingTransport считает экспорт успешным и не ретраит. Данные
 *    продолжают буферизоваться в Batch-процессорах и уедут, когда сеть вернётся;
 *  - если сеть есть, но запрос упал с сетевой ошибкой — резолвим 2xx, чтобы не плодить
 *    ретраи с бэкоффом (сам fetch уже завершился ошибкой, повторять бессмысленно).
 *
 * Обычные (не-OTLP) запросы приложения проходят насквозь без изменений.
 */
function installOfflineOtlpGate() {
  const otlpBaseUrl = OTEL_EXPORTER_OTLP_ENDPOINT.replace(/\/(?:v1\/(?:traces|metrics|logs))?\/?$/, '')
  const otlpHostPattern = otlpBaseUrl
    ? new RegExp(`^${otlpBaseUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/`)
    : null

  if (!otlpHostPattern || typeof globalThis.fetch !== 'function')
    return

  // В рантайме (браузер, Vite web-target) globalThis.fetch — стандартный DOM-fetch.
  // Аннотируем явными DOM-типами, а не `typeof fetch` (в проекте с @types/bun он
  // резолвится в Bun-fetch с лишним полем preconnect и ломает присваивание).
  type BrowserFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
  const originalFetch: BrowserFetch = globalThis.fetch as BrowserFetch

  /** Притворный 2xx — RetryingTransport считает экспорт успешным и не ретраит */
  const fakeSuccess = () => Promise.resolve(new Response(null, { status: 200 }))

  const isOtlp = (input: RequestInfo | URL): boolean => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input?.url

    return !!url && otlpHostPattern.test(url)
  }

  const wrappedFetch: BrowserFetch = (input, init) => {
    // Для не-OTLP запросов — без изменений.
    if (!isOtlp(input))
      return originalFetch(input, init)

    // Оффлайн: мгновенный синтетический успех — без ретраев и «вечного» потока запросов.
    if (typeof navigator !== 'undefined' && navigator.onLine === false)
      return fakeSuccess()

    try {
      return originalFetch(input, init)
    }
    catch (error) {
      // Сеть отвалилась уже во время запроса (TypeError без cause — сетевая ошибка,
      // та же эвристика, что и isFetchNetworkErrorRetryable в otlp-exporter-base).
      if (error instanceof TypeError && !error.cause)
        return fakeSuccess()
      throw error
    }
  }

  // Присваивание глобал-патча: таргет `globalThis.fetch` типизирован Bun-типами
  // (требует пре-заданный `preconnect`), в браузере же это стандартный DOM-fetch —
  // кастим явно, это осознанный срез неверной типизации для рантайма.
  globalThis.fetch = wrappedFetch as typeof fetch
}

const otlpBaseUrl = OTEL_EXPORTER_OTLP_ENDPOINT.replace(/\/(?:v1\/(?:traces|metrics|logs))?\/?$/, '')

function otlpSignalUrl(signal: 'traces' | 'logs' | 'metrics') {
  return `${otlpBaseUrl}/v1/${signal}`
}

/** Атрибуты пользователя, прикрепляются ко всем спанам и лог-записям */
let userAttributes: Record<string, string> = {}

/**
 * Обогащает каждый спан (включая спаны авто-инструментаций fetch/XHR/document-load)
 * атрибутами пользователя.
 */
class UserAttributesSpanProcessor implements SpanProcessor {
  onStart(span: Span): void {
    for (const [key, value] of Object.entries(userAttributes))
      span.setAttribute(key, value)
  }

  onEnd(): void { }

  shutdown(): Promise<void> {
    return Promise.resolve()
  }

  forceFlush(): Promise<void> {
    return Promise.resolve()
  }
}

function stringifyAttributes(attributes?: Record<string, unknown>): Record<string, string> {
  const result: Record<string, string> = {}

  if (attributes) {
    for (const [key, value] of Object.entries(attributes)) {
      if (value !== undefined && value !== null) {
        result[key] = typeof value === 'object'
          ? JSON.stringify(value)
          : String(value)
      }
    }
  }

  return result
}

/** Наблюдает Server-Timing через PerformanceObserver и отправляет длительности как OTLP-метрики */
export function setupServerTimingObserver(serverTimingHistogram: Histogram) {
  if (!('PerformanceObserver' in window))
    return

  const apiPattern = API_URL
    ? new RegExp(`^${API_URL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`)
    : null

  try {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (apiPattern && !apiPattern.test(entry.name))
          continue

        const serverTiming = (entry as PerformanceResourceTiming).serverTiming
        if (!serverTiming || serverTiming.length === 0)
          continue

        const metrics: Record<string, number> = {}
        for (const st of serverTiming) {
          metrics[st.name] = st.duration
        }

        if (Object.keys(metrics).length === 0)
          continue

        for (const [metric, duration] of Object.entries(metrics)) {
          serverTimingHistogram.record(duration, {
            metric,
            url: entry.name,
            entry_type: entry.entryType,
            ...userAttributes,
          })
        }
      }
    })

    observer.observe({ type: 'navigation', buffered: true })
    observer.observe({ type: 'resource', buffered: true })
  }
  catch {
    // Server Timing API не поддерживается браузером — молча пропускаем
  }
}

/** Инструменты Web Vitals (имена метрик — как в официальной документации SigNoz) */
interface WebVitalsInstruments {
  lcp: Histogram
  inp: Histogram
  ttfb: Histogram
  fcp: Histogram
  fid: Histogram
  cls: ObservableGauge
}

/**
 * Собирает Core Web Vitals (LCP, INP, CLS, TTFB, FCP) через web-vitals
 * и экспортирует их как OTLP-метрики.
 * Передача reportAllChanges: true гарантирует немедленную запись измерений.
 */
function setupWebVitals(vitals: WebVitalsInstruments) {
  let clsValue: number | null = null

  vitals.cls.addCallback((result) => {
    if (clsValue !== null)
      result.observe(clsValue)
  })

  const record = (metric: Metric) => {
    const attributes = { navigationType: metric.navigationType }
    switch (metric.name) {
      case 'LCP':
        vitals.lcp.record(metric.value, attributes)
        break
      case 'INP':
        vitals.inp.record(metric.value, attributes)
        break
      case 'TTFB':
        vitals.ttfb.record(metric.value, attributes)
        break
      case 'FCP':
        vitals.fcp.record(metric.value, attributes)
        break
      case 'CLS':
        clsValue = metric.value
        break
    }
  }

  const options = { reportAllChanges: true }

  onCLS(record, options)
  onINP(record, options)
  onLCP(record, options)
  onTTFB(record, options)
  onFCP(record, options)

  if ('PerformanceObserver' in window) {
    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries() as PerformanceEventTiming[]) {
          vitals.fid.record(entry.processingStart - entry.startTime)
        }
      }).observe({ type: 'first-input', buffered: true })
    }
    catch {
      // first-input не поддерживается браузером — молча пропускаем
    }
  }
}

/**
 * Инициализирует OpenTelemetry Web SDK (нативный стек SigNoz):
 * - WebTracerProvider + ZoneContextManager → спаны страниц, fetch/XHR, кликов
 * - LoggerProvider → ошибки и кастомные события
 * - MeterProvider → Web Vitals, server-timing, счётчики событий/ошибок
 */
export function initMonitoring() {
  if (!OTEL_EXPORTER_OTLP_ENDPOINT)
    return

  // Оффлайн-гейт должен встать до создания экспортёров: отсекает OTLP-запросы
  // при отсутствии сети, чтобы не плодить ретраи с бэкоффом (см. докблок функции).
  installOfflineOtlpGate()

  const resource = resourceFromAttributes({
    'service.name': SERVICE_NAME,
    'service.version': packageJson.version,
    'deployment.environment': import.meta.env.MODE,
  })

  // --- Traces ---
  const tracerProvider = new WebTracerProvider({
    resource,
    spanProcessors: [
      new UserAttributesSpanProcessor(),
      new BatchSpanProcessor(new OTLPTraceExporter({ url: otlpSignalUrl('traces') }), {
        scheduledDelayMillis: 5_000,
      }),
    ],
  })

  tracerProvider.register({
    contextManager: new ZoneContextManager(),
  })

  // --- Logs ---
  const loggerProvider = new LoggerProvider({
    resource,
    processors: [
      new BatchLogRecordProcessor({
        exporter: new OTLPLogExporter({ url: otlpSignalUrl('logs') }),
        scheduledDelayMillis: 5_000,
      }),
    ],
  })
  logs.setGlobalLoggerProvider(loggerProvider)
  otelLogger = logs.getLogger(SERVICE_NAME)

  // --- Metrics ---
  const metricReader = new PeriodicExportingMetricReader({
    exporter: new OTLPMetricExporter({ url: otlpSignalUrl('metrics') }),
    exportIntervalMillis: 5_000,
  })
  const meterProvider = new MeterProvider({ resource, readers: [metricReader] })
  const meter = meterProvider.getMeter(SERVICE_NAME, packageJson.version)

  metrics.setGlobalMeterProvider(meterProvider)

  const serverTimingHistogram = meter.createHistogram('app.server_timing', {
    description: 'Длительности Server-Timing заголовков API (ms)',
    unit: 'ms',
  })
  eventCounter = meter.createCounter('app.events', { description: 'Пользовательские события приложения' })
  errorCounter = meter.createCounter('app.errors', { description: 'Перехваченные ошибки фронтенда' })

  const webVitalsMeter = meterProvider.getMeter('web-vitals')
  setupWebVitals({
    lcp: webVitalsMeter.createHistogram('lcp', { description: 'Largest Contentful Paint', unit: 'ms' }),
    inp: webVitalsMeter.createHistogram('inp', { description: 'Interaction to Next Paint', unit: 'ms' }),
    ttfb: webVitalsMeter.createHistogram('ttfb', { description: 'Time to First Byte', unit: 'ms' }),
    fcp: webVitalsMeter.createHistogram('fcp', { description: 'First Contentful Paint', unit: 'ms' }),
    fid: webVitalsMeter.createHistogram('fid', { description: 'First Input Delay (устаревшая, заменена на INP)', unit: 'ms' }),
    cls: webVitalsMeter.createObservableGauge('cls', { description: 'Cumulative Layout Shift' }),
  })

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden')
      metricReader.forceFlush()
  })

  const apiTracePattern = API_URL
    ? new RegExp(`^${API_URL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`)
    : undefined

  const mediaIgnorePattern = /\/api\/uploads\//

  registerInstrumentations({
    instrumentations: [
      new DocumentLoadInstrumentation(),
      new FetchInstrumentation({
        propagateTraceHeaderCorsUrls: apiTracePattern,
        ignoreUrls: [mediaIgnorePattern],
      }),
      new UserInteractionInstrumentation(),
      new XMLHttpRequestInstrumentation({
        propagateTraceHeaderCorsUrls: apiTracePattern,
        ignoreUrls: [mediaIgnorePattern],
      }),
    ],
  })

  enabled = true

  setupServerTimingObserver(serverTimingHistogram)
}

export function setupVueMonitoring(app: App, router: Router) {
  if (!enabled)
    return

  const originalErrorHandler = app.config.errorHandler
  app.config.errorHandler = (err, instance, info) => {
    trackError(err, {
      vue_component: instance?.$options?.name || instance?.$options?.__name || 'UnknownComponent',
      vue_info: String(info),
    })

    if (originalErrorHandler) {
      originalErrorHandler(err, instance, info)
    }
  }

  router.afterEach((to) => {
    const pageName = String(to.name || to.path)

    tracer.startSpan('routeChange', {
      attributes: {
        'view.name': pageName,
        'page.url': to.fullPath,
      },
    }).end()
  })

  window.addEventListener('error', (event) => {
    trackError(event.error ?? new Error(event.message), { source: 'window.onerror' })
  })
  window.addEventListener('unhandledrejection', (event) => {
    trackError(event.reason, { source: 'unhandledrejection' })
  })
}

export function setTelemetryUser(userData: { id: string | number, username?: string, role?: string }) {
  userAttributes = {
    'enduser.id': String(userData.id),
    ...(userData.username ? { 'enduser.username': userData.username } : {}),
    ...(userData.role ? { 'user.role': userData.role } : {}),
  }
}

export function resetTelemetryUser() {
  userAttributes = {}
}

export function trackEvent(name: TelemetryEventName, attributes?: Record<string, unknown>) {
  if (!enabled)
    return

  otelLogger.emit({
    body: name,
    severityNumber: SEVERITY_INFO,
    severityText: 'INFO',
    attributes: {
      event_name: name,
      ...userAttributes,
      ...stringifyAttributes(attributes),
    },
  })

  eventCounter?.add(1, {
    event_name: name,
    ...userAttributes,
  })
}

export function trackError(error: Error | unknown, context?: Record<string, unknown>) {
  if (!enabled)
    return

  const err = error instanceof Error
    ? error
    : new Error(typeof error === 'string' ? error : JSON.stringify(error))

  const attributes: Attributes = {
    ...userAttributes,
    ...stringifyAttributes(context),
  }

  const span = trace.getActiveSpan()
  if (span) {
    span.recordException(err)
    span.setStatus({ code: SpanStatusCode.ERROR, message: err.message })
  }

  otelLogger.emit({
    body: `${err.name}: ${err.message}`,
    severityNumber: SEVERITY_ERROR,
    severityText: 'ERROR',
    attributes,
  })

  errorCounter?.add(1, {
    error_type: err.name,
    ...userAttributes,
  })
}
