import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { eq, sql } from 'drizzle-orm'
import jwt from 'jsonwebtoken'
import { z } from 'zod'
import { AUTH_MODE, CORS_HEADERS, JWT_SECRET, UPLOADS_PATH } from '../config'
import { db } from '../db'
import * as schema from '../db/schema'
import { AppError } from '../utils/errors'

// Выводим строгий тип пользователя напрямую из Drizzle-схемы
type DbUser = typeof schema.users.$inferSelect

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

async function getUserPayload(user: DbUser) {
  const [{ count: usedBooks }] = await db.select({ count: sql<number>`count(*)` })
    .from(schema.books)
    .where(eq(schema.books.userId, user.id))

  const [{ totalTokens }] = await db.select({
    totalTokens: sql<number>`COALESCE(SUM(${schema.tokenUsage.inputTokens} + ${schema.tokenUsage.outputTokens}), 0)`.mapWith(Number),
  })
    .from(schema.tokenUsage)
    .where(eq(schema.tokenUsage.userId, user.id))

  if (user.usedTokens !== totalTokens) {
    await db.update(schema.users)
      .set({ usedTokens: totalTokens })
      .where(eq(schema.users.id, user.id))
      .catch(console.error)
  }

  return {
    id: user.id,
    username: user.username,
    role: user.role,
    usedTokens: totalTokens,
    tokenLimit: user.tokenLimit,
    usedBooks,
    bookLimit: user.bookLimit,
    pushTargetDeckId: user.pushTargetDeckId,
    pushTimeStart: user.pushTimeStart,
    pushTimeEnd: user.pushTimeEnd,
    pushCount: user.pushCount,
    timezone: user.timezone,
    uiLanguage: user.uiLanguage,
    avatarUrl: user.avatarUrl,
  }
}

export async function handleLogin(req: Request): Promise<Response> {
  if (AUTH_MODE === 'single') {
    const user = await db.query.users.findFirst({ where: eq(schema.users.id, 1) })
    if (user) {
      const userPayload = await getUserPayload(user)
      return json({ token: 'dummy-token', user: userPayload })
    }
    return json({ token: 'dummy-token', user: { id: 1, username: 'admin', role: 'admin' } })
  }

  const { username, password } = LoginSchema.parse(await req.json())

  const user = await db.query.users.findFirst({ where: eq(schema.users.username, username) })
  if (!user)
    throw new AppError(401, 'Неверный логин или пароль')

  const isMatch = await Bun.password.verify(password, user.passwordHash)
  if (!isMatch)
    throw new AppError(401, 'Неверный логин или пароль')

  const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '30d' })
  const userPayload = await getUserPayload(user)

  return json({ token, user: userPayload })
}

export async function handleGetMe(req: Request, userId: number): Promise<Response> {
  const user = await db.query.users.findFirst({ where: eq(schema.users.id, userId) })
  if (!user)
    throw new AppError(404, 'Пользователь не найден')

  const userPayload = await getUserPayload(user)

  return json({
    user: userPayload,
    mode: AUTH_MODE,
  })
}

export async function handleUpdateAvatar(req: Request, userId: number): Promise<Response> {
  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file)
    throw new AppError(400, 'Файл не передан')

  const buffer = await file.arrayBuffer()
  const ext = path.extname(file.name).toLowerCase() || '.jpg'
  const filename = `${Date.now()}_avatar_${userId}${ext}`
  const avatarsDir = path.join(UPLOADS_PATH, 'avatars')
  const filepath = path.join(avatarsDir, filename)

  mkdirSync(avatarsDir, { recursive: true })
  await Bun.write(filepath, buffer)

  const avatarUrl = `/api/uploads/avatars/${filename}`
  await db.update(schema.users).set({ avatarUrl }).where(eq(schema.users.id, userId))

  return json({ success: true, avatarUrl })
}

export async function handleGetAvatarImage(req: Request): Promise<Response> {
  const filename = req.params.filename
  const filepath = path.join(UPLOADS_PATH, 'avatars', filename)
  const file = Bun.file(filepath)

  if (!(await file.exists()))
    return new Response('Not found', { status: 404 })

  return new Response(file, {
    headers: {
      ...CORS_HEADERS,
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  })
}

export async function handleUpdateUsername(req: Request, userId: number): Promise<Response> {
  const body = await req.json()
  const username = body.username

  if (!username || typeof username !== 'string' || username.trim().length < 2) {
    throw new AppError(400, 'Некорректное имя пользователя')
  }

  const newUsername = username.trim()

  const existing = await db.query.users.findFirst({ where: eq(schema.users.username, newUsername) })
  if (existing && existing.id !== userId) {
    throw new AppError(400, 'Имя пользователя уже занято')
  }

  await db.update(schema.users).set({ username: newUsername }).where(eq(schema.users.id, userId))

  return json({ success: true, username: newUsername })
}