import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { eq, sql } from 'drizzle-orm'
import jwt from 'jsonwebtoken'
import { z } from 'zod'
import { AUTH_MODE, CORS_HEADERS, FRONTEND_URL, JWT_SECRET, UPLOADS_PATH, YANDEX_CLIENT_ID, YANDEX_CLIENT_SECRET } from '../config'
import { db } from '../db'
import * as schema from '../db/schema'
import { AppError } from '../utils/errors'

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

export async function handleGetMe(req: Request, userId: number | null): Promise<Response> {
  if (userId === null) {
    return json({ user: null, mode: AUTH_MODE })
  }

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

// For mobile (Tauri APK): Yandex redirects directly to the app via custom scheme
// IMPORTANT: register 'insightbook://auth/callback' in Yandex OAuth settings
const MOBILE_REDIRECT_URI = 'insightbook://auth/callback'
const WEB_REDIRECT_URI = `${FRONTEND_URL}/api/auth/yandex/callback`

async function exchangeYandexCode(code: string, redirectUri: string) {
  const tokenRes = await fetch('https://oauth.yandex.ru/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${Buffer.from(`${YANDEX_CLIENT_ID}:${YANDEX_CLIENT_SECRET}`).toString('base64')}`,
    },
    body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: redirectUri }).toString(),
  })

  if (!tokenRes.ok) {
    const errText = await tokenRes.text().catch(() => '')
    throw new AppError(400, `Failed to exchange token: ${errText}`)
  }
  const tokenData = (await tokenRes.json()) as any

  const userRes = await fetch('https://login.yandex.ru/info?format=json', {
    headers: { Authorization: `OAuth ${tokenData.access_token}` },
  })
  if (!userRes.ok)
    throw new AppError(400, 'Failed to fetch user info')
  const userData = (await userRes.json()) as any

  const yandexId = String(userData.id)
  let user = await db.query.users.findFirst({ where: eq(schema.users.yandexId, yandexId) })

  if (!user) {
    let proposedUsername = userData.login || `yandex_${yandexId}`
    const existing = await db.query.users.findFirst({ where: eq(schema.users.username, proposedUsername) })
    if (existing)
      proposedUsername = `yandex_${yandexId}_${Date.now()}`

    const dummyPassword = await Bun.password.hash(crypto.randomUUID())
    const [newUser] = await db.insert(schema.users).values({
      yandexId,
      username: proposedUsername,
      passwordHash: dummyPassword,
      avatarUrl: userData.default_avatar_id
        ? `https://avatars.yandex.net/get-yapic/${userData.default_avatar_id}/islands-200`
        : null,
    }).returning()
    user = newUser
  }

  return jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '30d' })
}

export async function handleYandexAuth(req: Request): Promise<Response> {
  const reqUrl = new URL(req.url)
  const isMobile = reqUrl.searchParams.get('source') === 'tauri'
  const redirectUri = isMobile ? MOBILE_REDIRECT_URI : WEB_REDIRECT_URI

  const url = new URL('https://oauth.yandex.ru/authorize')
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('client_id', YANDEX_CLIENT_ID)
  url.searchParams.set('redirect_uri', redirectUri)

  return new Response(null, {
    status: 302,
    headers: { Location: url.toString() },
  })
}

// Web-only: called by browser after Yandex redirects with code
export async function handleYandexCallback(req: Request): Promise<Response> {
  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  if (!code)
    throw new AppError(400, 'No code provided')

  const token = await exchangeYandexCode(code, WEB_REDIRECT_URI)

  const frontendUrl = new URL(FRONTEND_URL)
  frontendUrl.pathname = '/auth/yandex/callback'
  frontendUrl.searchParams.set('token', token)

  return new Response(null, {
    status: 302,
    headers: { Location: frontendUrl.toString() },
  })
}

// Mobile-only: APK receives code via insightbook://auth/callback?code=...
// then POST here to exchange code for JWT
export async function handleYandexMobileExchange(req: Request): Promise<Response> {
  const body = await req.json().catch(() => ({}))
  const code = (body as any)?.code
  if (!code)
    throw new AppError(400, 'No code provided')

  const token = await exchangeYandexCode(code, MOBILE_REDIRECT_URI)
  return json({ token })
}
