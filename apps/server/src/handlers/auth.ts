/// <reference types="bun-types" />

import { eq } from 'drizzle-orm'
import jwt from 'jsonwebtoken'
import { z } from 'zod'
import { AUTH_MODE, CORS_HEADERS, JWT_SECRET } from '../config'
import { db } from '../db'
import * as schema from '../db/schema'
import { AppError } from '../utils/errors'

const LoginSchema = z.object({
  username: z.string().min(1, 'Имя пользователя обязательно'),
  password: z.string().min(1, 'Пароль обязателен'),
})

function json(data: unknown, status = 200, extraHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json', ...extraHeaders },
  })
}

export async function handleLogin(req: Request): Promise<Response> {
  if (AUTH_MODE === 'single') {
    return json({ token: 'dummy-token', user: { id: 1, username: 'admin' } })
  }

  const { username, password } = LoginSchema.parse(await req.json())

  // Ищем юзера
  const user = await db.query.users.findFirst({ where: eq(schema.users.username, username) })

  // Если юзера нет или пароль не совпадает — выдаем ошибку 401
  if (!user) {
    throw new AppError(401, 'Неверный логин или пароль')
  }

  const isMatch = await Bun.password.verify(password, user.passwordHash)
  if (!isMatch) {
    throw new AppError(401, 'Неверный логин или пароль')
  }

  // Выдаем токен
  const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '30d' })

  return json({ token, user: { id: user.id, username: user.username } })
}

export async function handleGetMe(req: Request, userId: number): Promise<Response> {
  const user = await db.query.users.findFirst({ where: eq(schema.users.id, userId) })
  if (!user)
    throw new AppError(404, 'Пользователь не найден')

  return json({
    user: { id: user.id, username: user.username },
    mode: AUTH_MODE,
  })
}
