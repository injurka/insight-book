import type { ErrorCode } from '../constants/error-codes'
import { CORS_HEADERS } from '../config'
import { ERROR_CODES } from '../constants/error-codes'
import { logger } from '../utils/logger'

export class AppError extends Error {
  public readonly code: ErrorCode
  public readonly details?: Record<string, unknown>

  constructor(
    public readonly statusCode: number,
    codeOrMessage: ErrorCode,
    messageOrDetails?: string | Record<string, unknown>,
    details?: Record<string, unknown>,
  ) {
    let finalCode: ErrorCode
    let finalMessage: string
    let finalDetails: Record<string, unknown> | undefined

    if (typeof messageOrDetails === 'object' && messageOrDetails !== null) {
      finalDetails = messageOrDetails
      const isCode = !codeOrMessage.includes(' ') && codeOrMessage === codeOrMessage.toUpperCase()
      finalCode = isCode ? codeOrMessage : ERROR_CODES.SYSTEM.INTERNAL_SERVER_ERROR
      finalMessage = codeOrMessage
    }
    else {
      const isCode = !codeOrMessage.includes(' ') && codeOrMessage === codeOrMessage.toUpperCase()
      finalCode = isCode ? codeOrMessage : 'APP_ERROR'
      finalMessage = (typeof messageOrDetails === 'string' && messageOrDetails) ? messageOrDetails : codeOrMessage
      finalDetails = details
    }

    super(finalMessage)
    this.name = 'AppError'
    this.code = finalCode
    this.details = finalDetails
  }
}

export interface ProcessedError {
  status: number
  code: string
  message: string
  error: string
  details?: Record<string, unknown>
}

function parseZodErrorMessage(error: unknown): string {
  const zodError = error as { issues?: { path: string[], message: string }[], errors?: { path: string[], message: string }[] }
  const issues = zodError.issues || zodError.errors || []
  if (issues.length === 0)
    return 'Ошибка валидации данных.'
  return issues.map(e => `${e.path.join('.')}: ${e.message}`).join('; ')
}

export function extractErrorInfo(error: unknown): ProcessedError {
  if (error instanceof AppError) {
    return {
      status: error.statusCode,
      code: error.code,
      message: error.message,
      error: error.message,
      details: error.details,
    }
  }

  if (error && typeof error === 'object' && 'name' in error && error.name === 'ZodError') {
    const msg = parseZodErrorMessage(error)
    return {
      status: 400,
      code: ERROR_CODES.SYSTEM.VALIDATION_ERROR,
      message: msg,
      error: msg,
    }
  }

  return {
    status: 500,
    code: ERROR_CODES.SYSTEM.INTERNAL_SERVER_ERROR,
    message: 'Internal server error',
    error: 'Internal server error',
  }
}

export function handleElysiaError({ error, set }: { error: unknown, set: { status?: number | string } }): ProcessedError {
  const processed = extractErrorInfo(error)
  set.status = processed.status
  return processed
}

export function apiWrapper(handler: (req: Request) => Promise<Response> | Response): (req: Request) => Promise<Response> {
  return async (req: Request) => {
    try {
      return await handler(req)
    }
    catch (error: unknown) {
      const processed = extractErrorInfo(error)

      if (processed.status >= 500) {
        logger.error({ err: error }, `[API Error] ${req.method} ${req.url}:`)
      }

      return new Response(JSON.stringify(processed), {
        status: processed.status,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      })
    }
  }
}
