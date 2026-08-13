import type { Attributes, Span } from '@opentelemetry/api'
import type { Logger } from '@opentelemetry/api-logs'
import type { SpanProcessor } from '@opentelemetry/sdk-trace-web'
import type { App } from 'vue'
import type { Router } from 'vue-router'
import { SpanStatusCode, trace } from '@opentelemetry/api'
import { logs } from '@opentelemetry/api-logs'
import { getWebAutoInstrumentations } from '@opentelemetry/auto-instrumentations-web'
import { ZoneContextManager } from '@opentelemetry/context-zone-peer-dep'
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http'
import { registerInstrumentations } from '@opentelemetry/instrumentation'
import { resourceFromAttributes } from '@opentelemetry/resources'
import { BatchLogRecordProcessor, LoggerProvider } from '@opentelemetry/sdk-logs'
import { BatchSpanProcessor, WebTracerProvider } from '@opentelemetry/sdk-trace-web'
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

// Логгер привязывается к глобальному провайдеру; провайдер ставится в initMonitoring(),
// поэтому пересоздаём логгер после инициализации.
let otelLogger: Logger = logs.getLogger(SERVICE_NAME)
let enabled = false

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

  onEnd(): void {}

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

/** Наблюдает Server-Timing метрики через PerformanceObserver и отправляет их как лог-записи */
export function setupServerTimingObserver() {
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

        otelLogger.emit({
          body: 'server-timing',
          severityNumber: SEVERITY_INFO,
          severityText: 'INFO',
          attributes: {
            url: entry.name,
            entry_type: entry.entryType,
            ...userAttributes,
            ...metrics,
          },
        })
      }
    })

    // Наблюдаем navigation (основные запросы страниц) и resource (fetch/XHR)
    observer.observe({ type: 'navigation', buffered: true })
    observer.observe({ type: 'resource', buffered: true })
  }
  catch {
    // Server Timing API не поддерживается браузером — молча пропускаем
  }
}

/**
 * Инициализирует OpenTelemetry Web SDK (нативный стек SigNoz):
 * - WebTracerProvider + ZoneContextManager → спаны страниц, fetch/XHR, кликов
 * - OTLP/HTTP экспортеры (traces + logs) → SigNoz ingester
 *
 * Требует `import 'zone.js'` первым импортом в main.ts.
 */
export function initMonitoring() {
  if (!OTEL_EXPORTER_OTLP_ENDPOINT)
    return

  const resource = resourceFromAttributes({
    'service.name': SERVICE_NAME,
    'service.version': packageJson.version,
    'deployment.environment': import.meta.env.MODE,
  })

  // --- Traces: страницы, запросы, интеракции ---
  const tracerProvider = new WebTracerProvider({
    resource,
    spanProcessors: [
      new UserAttributesSpanProcessor(),
      new BatchSpanProcessor(new OTLPTraceExporter({ url: OTEL_EXPORTER_OTLP_ENDPOINT })),
    ],
  })

  tracerProvider.register({
    contextManager: new ZoneContextManager(),
  })

  // --- Logs: кастомные события, ошибки, server-timing ---
  const loggerProvider = new LoggerProvider({
    resource,
    processors: [
      new BatchLogRecordProcessor({
        exporter: new OTLPLogExporter({ url: OTEL_EXPORTER_OTLP_ENDPOINT }),
      }),
    ],
  })
  logs.setGlobalLoggerProvider(loggerProvider)
  otelLogger = logs.getLogger(SERVICE_NAME)

  // --- Авто-инструментации: document-load, fetch, XHR, user-interaction ---
  registerInstrumentations({
    instrumentations: getWebAutoInstrumentations(),
  })

  enabled = true

  setupServerTimingObserver()
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

  // Глобальные ошибки, которые не проходят через Vue errorHandler
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

  // Исключение в активный спан — видно в трейсе операции (если спан есть)
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
}
