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

// Стабильные ключи resource-атрибутов.
// host.name и service.name необходимы для корректной фильтрации в SigNoz.
const otlpResource = resourceFromAttributes({
  'service.name': OTEL_SERVICE_NAME,
  'deployment.environment': NODE_ENV,
  'host.name': hostname(),
})

// Телеметрия активна при наличии конечной точки коллектора OTLP
const isTelemetryEnabled = Boolean(OTEL_EXPORTER_OTLP_ENDPOINT)

/**
 * OpenTelemetry plugin.
 *
 * Под капотом @elysiajs/opentelemetry стартует NodeSDK, которому мы передаем:
 * - traces  — BatchSpanProcessor → OTLP/HTTP (proto)
 * - metrics — PeriodicExportingMetricReader → OTLP/HTTP (proto), раз в 10 сек
 * - resource — service.name + deployment.environment + host.name
 */
export const telemetryPlugin
  = isTelemetryEnabled
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
 * Runtime-метрики процесса (память RSS, Heap и т.д.).
 * Вызывается после инициализации OTel SDK в index.ts.
 */
export function registerRuntimeMetrics(): void {
  if (!isTelemetryEnabled)
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
