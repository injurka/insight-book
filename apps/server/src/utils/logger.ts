import pino from 'pino'

const isDev = process.env.NODE_ENV !== 'production'

const stream = isDev
  ? pino.transport({
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:standard',
        ignore: 'pid,hostname',
      },
    })
  : pino.destination({ sync: true })

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
}, stream)
