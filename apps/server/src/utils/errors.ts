import { CORS_HEADERS } from '../config'

export class AppError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message)
    this.name = 'AppError'
  }
}

export function apiWrapper(handler: (req: Request) => Promise<Response> | Response): (req: Request) => Promise<Response> {
  return async (req: Request) => {
    try {
      return await handler(req)
    }
    catch (error: unknown) {
      let status = 500
      let message = 'Внутренняя ошибка сервера. Пожалуйста, попробуйте позже.'

      if (error instanceof AppError) {
        status = error.statusCode
        message = error.message
      }
      else if (error && typeof error === 'object' && 'name' in error && error.name === 'ZodError') {
        status = 400
        const zodError = error as any
        const issues = zodError.issues || zodError.errors || []
        if (issues.length > 0) {
          message = issues.map((e: any) => `${e.path.join('.')}: ${e.message}`).join('; ')
        }
        else {
          message = 'Ошибка валидации данных.'
        }
      }

      if (status >= 500) {
        console.error(`[API Error] ${req.method} ${req.url}:`, error instanceof Error ? error.message : String(error))
      }

      return new Response(JSON.stringify({ error: message }), {
        status,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      })
    }
  }
}
