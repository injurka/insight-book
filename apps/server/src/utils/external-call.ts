import type { Attributes, Span } from '@opentelemetry/api'
import { context, SpanKind, SpanStatusCode, trace } from '@opentelemetry/api'

const externalTracer = trace.getTracer('insight-book-server')

/**
 * Санитизирует URL для телеметрии: без query/hash — там могут быть API-ключи
 * (например, Gemini принимает key в query-строке).
 */
export function sanitizeUrlForTelemetry(url: string): string {
  try {
    const u = new URL(url)
    u.search = ''
    u.hash = ''
    return u.toString()
  }
  catch {
    return url
  }
}

/** Вешает санитизированный URL на активный спан (для секции External calls в APM) */
export function attachUrlToActiveSpan(url: string): void {
  const sanitized = sanitizeUrlForTelemetry(url)
  trace.getActiveSpan()?.setAttributes({
    'http.url': sanitized,
    'url.full': sanitized,
  })
}

/**
 * Выполняет fn внутри активного CLIENT-спана: спан становится дочерним для
 * текущего трейса (браузер → API → внешний сервис). Ошибки помечаются
 * recordException + STATUS_ERROR и пробрасываются дальше.
 *
 * Под Bun нативный fetch не покрывается instrumentation-http/undici,
 * поэтому все исходящие HTTP-вызовы сервера оборачиваются через этот хелпер.
 */
export async function runWithClientSpan<T>(
  name: string,
  attributes: Attributes,
  fn: (span: Span) => Promise<T>,
): Promise<T> {
  const span = externalTracer.startSpan(name, {
    kind: SpanKind.CLIENT,
    attributes,
  })

  try {
    const ctx = trace.setSpan(context.active(), span)
    return await context.with(ctx, () => fn(span))
  }
  catch (error) {
    span.recordException(error as Error)
    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: (error as { message?: string })?.message || 'External call failed',
    })
    throw error
  }
  finally {
    span.end()
  }
}
