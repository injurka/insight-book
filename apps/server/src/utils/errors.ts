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
    catch (error: any) {
      let status = 500
      let message = 'Внутренняя ошибка сервера. Пожалуйста, попробуйте позже.'

      if (error instanceof AppError) {
        status = error.statusCode
        message = error.message
      }
      else if (error?.name === 'ZodError') {
        status = 400
        message = 'Ошибка валидации данных ИИ.'
      }

      if (status >= 500) {
        console.error(`[API Error] ${req.method} ${req.url}:`, error.message)
      }

      return new Response(JSON.stringify({ error: message }), {
        status,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      })
    }
  }
}
