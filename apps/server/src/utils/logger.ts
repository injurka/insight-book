import pino from 'pino'
import { NODE_ENV, OTEL_SERVICE_NAME } from '../config'

const isDev = NODE_ENV !== 'production'

// Dev: человекочитаемый вывод.
// Prod: логи уходят в OTLP-коллектор (SigNoz/Alloy) как OpenTelemetry
// log records. Транспорт самодостаточен (свой экспортер и batch-процессор),
// endpoint и resource читает из OTEL_*-env, проброшенных config.ts.
const stream = isDev
  ? pino.transport({
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:standard',
        ignore: 'pid,hostname',
      },
    })
  : pino.multistream([
      process.stdout,
      pino.transport({
        target: 'pino-opentelemetry-transport',
        options: {
          loggerName: OTEL_SERVICE_NAME,
        },
      }),
    ])

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
}, stream)
