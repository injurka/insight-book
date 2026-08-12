import { hostname } from 'node:os'
import { opentelemetry } from '@elysiajs/opentelemetry'
import { metrics } from '@opentelemetry/api'
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-proto'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto'
import { resourceFromAttributes } from '@opentelemetry/resources'
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics'
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-node'
import { Elysia } from 'elysia'
import { NODE_ENV, OTEL_EXPORTER_OTLP_ENDPOINT, OTEL_SERVICE_NAME } from '../config'

/**
 * Нормализует endpoint OTLP-коллектора до корневого URL:
 * отбрасывает сигнальный путь (/v1/traces|metrics|logs) и хвостовой слэш —
 * каждый экспортер допишет путь своего сигнала сам.
 */
function otlpRootUrl(endpoint: string): string {
  return endpoint.replace(/\/(?:v1\/(?:traces|metrics|logs))?\/?$/, '')
}

// Стабильные ключи resource-атрибутов (semconv 1.43 держит их только в
// deprecated-объекте, поэтому строковые литералы вместо констант).
// host.name важен: в ингестере SigNoz он входит в dimensions signozmeter.
const otlpResource = resourceFromAttributes({
  'service.name': OTEL_SERVICE_NAME,
  'deployment.environment': NODE_ENV,
  'host.name': hostname(),
})

/**
 * OpenTelemetry plugin — активен только в production.
 *
 * Под капотом @elysiajs/opentelemetry стартует NodeSDK, которому мы передаем:
 * - traces  — BatchSpanProcessor → OTLP/HTTP (proto)
 * - metrics — PeriodicExportingMetricReader → OTLP/HTTP (proto), раз в 10 сек
 * - resource — service.name + deployment.environment
 *
 * Конфигурация экспортеров:
 * - url           — endpoint OTLP-коллектора (SigNoz, Alloy, Jaeger и т.д.)
 * - keepAlive     — переиспользует TCP-соединения, снижает latency
 * - timeoutMillis — таймаут запроса к коллектору (по умолчанию 10 000 мс)
 *
 * Логи идут отдельным каналом: pino-opentelemetry-transport в utils/logger.ts
 * (самодостаточный экспортер; endpoint берет из тех же OTEL_*-env, которые
 * пробрасывает config.ts).
 */
export const telemetryPlugin
  = NODE_ENV === 'production'
    ? opentelemetry({
        serviceName: OTEL_SERVICE_NAME,
        resource: otlpResource,
        spanProcessors: [
          new BatchSpanProcessor(
            new OTLPTraceExporter({
              url: `${otlpRootUrl(OTEL_EXPORTER_OTLP_ENDPOINT)}/v1/traces`,
              keepAlive: true,
              timeoutMillis: 5_000,
            }),
          ),
        ],
        metricReader: new PeriodicExportingMetricReader({
          exporter: new OTLPMetricExporter({
            url: `${otlpRootUrl(OTEL_EXPORTER_OTLP_ENDPOINT)}/v1/metrics`,
            keepAlive: true,
            timeoutMillis: 5_000,
          }),
          exportIntervalMillis: 10_000,
        }),
      })
    : new Elysia()

/**
 * Runtime-метрики процесса (Bun-совместимо: без node-instrumentations,
 * которые под Bun не работают).
 *
 * ВАЖНО: вызывать ПОСЛЕ `.use(telemetryPlugin)` — meter должен биндиться
 * к уже запущенному SDK, иначе инструменты останутся у noop-провайдера.
 */
export function registerRuntimeMetrics(): void {
  if (NODE_ENV !== 'production')
    return

  const meter = metrics.getMeter(OTEL_SERVICE_NAME)

  const memoryGauge = meter.createObservableGauge('process.runtime.memory', {
    description: 'Использование памяти процессом, байты',
    unit: 'By',
  })

  memoryGauge.addCallback((result) => {
    const usage = process.memoryUsage()
    result.observe(usage.rss, { memory_type: 'rss' })
    result.observe(usage.heapUsed, { memory_type: 'heap_used' })
    result.observe(usage.heapTotal, { memory_type: 'heap_total' })
    result.observe(usage.external, { memory_type: 'external' })
    if (usage.arrayBuffers !== undefined)
      result.observe(usage.arrayBuffers, { memory_type: 'array_buffers' })
  })
}
