import jwt from 'jsonwebtoken'
import { AUTH_MODE, JWT_SECRET } from '../config'
import { AppError } from './errors'

export function authWrapper(handler: (req: Request, userId: number) => Promise<Response> | Response) {
  return async (req: Request) => {
    // В локальном режиме все действия выполняются от лица пользователя 1
    if (AUTH_MODE === 'single') {
      return handler(req, 1)
    }

    // В мульти-режиме требуем JWT
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
