import { Elysia } from 'elysia'
import jwt from 'jsonwebtoken'
import { AUTH_MODE, JWT_SECRET } from '../config'
import { AppError } from './errors'

export const authPlugin = new Elysia({ name: 'auth' }).derive({ as: 'scoped' }, ({ headers }) => {
  if (AUTH_MODE === 'single') {
    return { userId: 1 }
  }

  const authHeader = headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new AppError(401, 'Необходима авторизация')
  }

  const token = authHeader.split(' ')[1]
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: number }
    return { userId: decoded.userId }
  }
  catch {
    throw new AppError(401, 'Недействительный токен')
  }
})

export const optionalAuthPlugin = new Elysia({ name: 'optionalAuth' }).derive(({ headers }) => {
  if (AUTH_MODE === 'single') {
    return { userId: 1 }
  }

  const authHeader = headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { userId: null }
  }

  const token = authHeader.split(' ')[1]
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: number }
    return { userId: decoded.userId }
  }
  catch {
    return { userId: null }
  }
})
