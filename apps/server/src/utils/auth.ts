import jwt from 'jsonwebtoken'
import { AUTH_MODE, JWT_SECRET } from '../config'
import { AppError } from './errors'

export function authWrapper(handler: (req: Request, userId: number) => Promise<Response> | Response) {
  return async (req: Request) => {
    if (AUTH_MODE === 'single') {
      return handler(req, 1)
    }

    const authHeader = req.headers.get('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError(401, 'Необходима авторизация')
    }

    const token = authHeader.split(' ')[1]
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as { userId: number }
      return handler(req, decoded.userId)
    }
    catch {
      throw new AppError(401, 'Недействительный токен')
    }
  }
}

export function optionalAuthWrapper(handler: (req: Request, userId: number | null) => Promise<Response> | Response) {
  return async (req: Request) => {
    if (AUTH_MODE === 'single') {
      return handler(req, 1)
    }

    const authHeader = req.headers.get('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return handler(req, null)
    }

    const token = authHeader.split(' ')[1]
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as { userId: number }
      return handler(req, decoded.userId)
    }
    catch {
      return handler(req, null)
    }
  }
}
