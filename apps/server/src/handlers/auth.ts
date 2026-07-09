import { existsSync, mkdirSync, unlinkSync } from 'node:fs'
import path from 'node:path'
import { eq, sql } from 'drizzle-orm'
import jwt from 'jsonwebtoken'
import { z } from 'zod'
import { AUTH_MODE, CORS_HEADERS, FRONTEND_URL, JWT_SECRET, UNISENDER_API_KEY, UPLOAD_STORAGE, UPLOADS_PATH, YANDEX_CLIENT_ID, YANDEX_CLIENT_SECRET } from '../config'
import { db } from '../db'
import * as schema from '../db/schema'
import { s3Service } from '../services/s3.service'
import { AppError } from '../utils/errors'

type DbUser = typeof schema.users.$inferSelect

const LoginSchema = z.object({
  login: z.string().min(1, 'Логин или email обязателен'),
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
    .where(
      sql`${schema.books.userId} = ${user.id} AND datetime(${schema.books.createdAt}) >= datetime(${user.periodStart})`,
    )

  const [{ totalTokens }] = await db.select({
    totalTokens: sql<number>`COALESCE(SUM(${schema.tokenUsage.inputTokens} + ${schema.tokenUsage.outputTokens}), 0)`.mapWith(Number),
  })
    .from(schema.tokenUsage)
    .where(
      sql`${schema.tokenUsage.userId} = ${user.id} AND date(${schema.tokenUsage.date}) >= date(${user.periodStart})`,
    )

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

  const { login, password } = LoginSchema.parse(await req.json())

  const user = await db.query.users.findFirst({
    where: sql`${schema.users.username} = ${login} OR ${schema.users.email} = ${login}`,
  })

  if (!user)
    throw new AppError(401, 'Неверный логин или пароль')

  const isMatch = await Bun.password.verify(password, user.passwordHash)
  if (!isMatch)
    throw new AppError(401, 'Неверный логин или пароль')

  const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '30d' })
  const userPayload = await getUserPayload(user)

  return json({ token, user: userPayload })
}

const SendCodeSchema = z.object({
  email: z.string().email('Некорректный email'),
})

export async function handleSendCode(req: Request): Promise<Response> {
  const { email } = SendCodeSchema.parse(await req.json())

  const existingUser = await db.query.users.findFirst({
    where: eq(schema.users.email, email),
  })
  if (existingUser) {
    throw new AppError(400, 'Пользователь с таким email уже существует')
  }

  const code = Math.floor(100000 + Math.random() * 900000).toString()

  await db.insert(schema.emailConfirmations).values({ email, code })

  if (UNISENDER_API_KEY) {
    const htmlBody = `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 500px; margin: 0 auto; padding: 30px; background-color: #ffffff; border: 1px solid #e0e0e0; border-radius: 12px; text-align: center; box-shadow: 0 4px 15px rgba(0,0,0,0.05);">
        <h2 style="color: #1a1a1a; margin-top: 0; font-size: 24px;">Добро пожаловать в InsightBook!</h2>
        <p style="color: #555555; font-size: 16px; line-height: 1.5; margin-bottom: 25px;">
          Для завершения регистрации, пожалуйста, введите следующий код подтверждения:
        </p>
        <div style="background-color: #f3f4f6; border-radius: 8px; padding: 15px; margin-bottom: 25px;">
          <span style="font-size: 32px; font-weight: bold; color: #22c55e; letter-spacing: 8px;">${code}</span>
        </div>
        <p style="color: #888888; font-size: 13px; margin-bottom: 0;">
          Если вы не запрашивали этот код, просто проигнорируйте данное письмо.
        </p>
      </div>
      <div style="text-align: center; margin-top: 20px; color: #aaaaaa; font-size: 12px;">
        © ${new Date().getFullYear()} InsightBook. Все права защищены.
      </div>
    `

    const res = await fetch(`https://goapi.unisender.ru/ru/transactional/api/v1/email/send.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        api_key: UNISENDER_API_KEY,
        message: {
          skip_unsubscribe: 0,
          recipients: [{ email }],
          body: {
            html: htmlBody,
            plaintext: `Добро пожаловать в InsightBook!\n\nВаш код подтверждения: ${code}\n\nЕсли вы не запрашивали этот код, просто проигнорируйте данное письмо.`,
          },
          subject: 'Код подтверждения регистрации 🔐',
          from_email: 'noreply@insight-book.ru',
          from_name: 'InsightBook',
        },
      }),
    })

    const jsonRes = await res.json()

    if (jsonRes.status !== 'success') {
      console.error('Unisender Go error:', jsonRes)
      const errorMessage = jsonRes.message || (jsonRes.errors && jsonRes.errors[0]?.message) || 'Неизвестная ошибка'
      throw new AppError(500, `Ошибка при отправке письма: ${errorMessage}`)
    }
  }
  else {
    console.warn(`[DEV] Registration code for ${email}: ${code}`)
  }

  return json({ success: true, message: 'Код отправлен на почту' })
}

const RegisterSchema = z.object({
  email: z.string().email('Некорректный email'),
  code: z.string().length(6, 'Код должен состоять из 6 цифр'),
  password: z.string().min(6, 'Пароль должен быть не менее 6 символов'),
})

export async function handleRegister(req: Request): Promise<Response> {
  const { email, code, password } = RegisterSchema.parse(await req.json())

  const confirmation = await db.query.emailConfirmations.findFirst({
    where: sql`${schema.emailConfirmations.email} = ${email} AND ${schema.emailConfirmations.code} = ${code}`,
    orderBy: (c, { desc }) => [desc(c.createdAt)],
  })

  if (!confirmation) {
    throw new AppError(400, 'Неверный код подтверждения')
  }

  const createdAt = new Date(`${confirmation.createdAt}Z`).getTime()
  if (Date.now() - createdAt > 15 * 60 * 1000) {
    throw new AppError(400, 'Код подтверждения истек')
  }

  let randomUsername = `user_${Math.random().toString(36).substring(2, 8)}`
  let existingUser = await db.query.users.findFirst({ where: eq(schema.users.username, randomUsername) })
  while (existingUser) {
    randomUsername = `user_${Math.random().toString(36).substring(2, 8)}`
    existingUser = await db.query.users.findFirst({ where: eq(schema.users.username, randomUsername) })
  }

  const passwordHash = await Bun.password.hash(password)

  const [newUser] = await db.insert(schema.users).values({
    email,
    username: randomUsername,
    passwordHash,
  }).returning()

  await db.delete(schema.emailConfirmations).where(eq(schema.emailConfirmations.email, email))

  const token = jwt.sign({ userId: newUser.id }, JWT_SECRET, { expiresIn: '30d' })
  const userPayload = await getUserPayload(newUser)

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

  const user = await db.query.users.findFirst({ where: eq(schema.users.id, userId) })

  const buffer = await file.arrayBuffer()
  const ext = path.extname(file.name).toLowerCase() || '.jpg'
  const filename = `${Date.now()}_avatar_${userId}${ext}`

  if (UPLOAD_STORAGE === 's3') {
    if (user?.avatarUrl && user.avatarUrl.startsWith('/api/uploads/avatars/')) {
      const oldFilename = user.avatarUrl.split('/').pop()
      if (oldFilename) {
        await s3Service.deleteFile(`avatars/${oldFilename}`)
      }
    }
    await s3Service.uploadFile(`avatars/${filename}`, buffer, `image/${ext.slice(1)}`)
  }
  else {
    const avatarsDir = path.join(UPLOADS_PATH, 'avatars')
    const filepath = path.join(avatarsDir, filename)
    mkdirSync(avatarsDir, { recursive: true })

    if (user?.avatarUrl && user.avatarUrl.startsWith('/api/uploads/avatars/')) {
      const oldFilename = user.avatarUrl.split('/').pop()
      if (oldFilename) {
        const oldFilepath = path.join(avatarsDir, oldFilename)
        try {
          if (existsSync(oldFilepath)) {
            unlinkSync(oldFilepath)
          }
        }
        catch (e) {
          console.error('Failed to delete old avatar', e)
        }
      }
    }
    await Bun.write(filepath, buffer)
  }

  const avatarUrl = `/api/uploads/avatars/${filename}`
  await db.update(schema.users).set({ avatarUrl }).where(eq(schema.users.id, userId))

  return json({ success: true, avatarUrl })
}

export async function handleGetAvatarImage(req: Request): Promise<Response> {
  const filename = req.params.filename

  if (UPLOAD_STORAGE === 's3') {
    const s3Key = `avatars/${filename}`
    const fileData = await s3Service.getFile(s3Key)
    if (!fileData) {
      return new Response('Not found', { status: 404 })
    }
    return new Response(fileData.buffer as any, {
      headers: {
        ...CORS_HEADERS,
        'Content-Type': fileData.contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    })
  }
  else {
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

const WEB_REDIRECT_URI = `${FRONTEND_URL}/api/auth/yandex/callback`
const authSessions = new Map<string, string>()

async function exchangeYandexCode(code: string) {
  const tokenRes = await fetch('https://oauth.yandex.ru/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${Buffer.from(`${YANDEX_CLIENT_ID}:${YANDEX_CLIENT_SECRET}`).toString('base64')}`,
    },
    body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: WEB_REDIRECT_URI }).toString(),
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
  const sessionId = reqUrl.searchParams.get('session_id')

  const url = new URL('https://oauth.yandex.ru/authorize')
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('client_id', YANDEX_CLIENT_ID)
  url.searchParams.set('redirect_uri', WEB_REDIRECT_URI)

  if (sessionId) {
    url.searchParams.set('state', sessionId)
  }

  return new Response(null, {
    status: 302,
    headers: { Location: url.toString() },
  })
}

export async function handleYandexCallback(req: Request): Promise<Response> {
  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  if (!code)
    throw new AppError(400, 'No code provided')

  const token = await exchangeYandexCode(code)

  if (state && state.length > 10) {
    authSessions.set(state, token)

    const html = `
      <!DOCTYPE html>
      <html lang="ru">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>Авторизация</title>
        <style>
          body { font-family: sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; background: #0d1117; color: #fff; text-align: center; }
          .icon { font-size: 64px; margin-bottom: 16px; color: #22c55e; }
        </style>
      </head>
      <body>
        <div class="icon">✓</div>
        <h2>Вход успешно выполнен!</h2>
        <p style="color: #8b949e;">Вы можете закрыть этот браузер и вернуться в приложение InsightBook.</p>
      </body>
      </html>
    `
    return new Response(html, {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  }

  const frontendUrl = new URL(FRONTEND_URL)
  frontendUrl.pathname = '/auth/yandex/callback'
  frontendUrl.searchParams.set('token', token)

  return new Response(null, {
    status: 302,
    headers: { Location: frontendUrl.toString() },
  })
}

export async function handleYandexMobileExchange(_req: Request): Promise<Response> {
  throw new AppError(400, 'Not implemented')
}

export async function handleAuthSessionStatus(req: Request): Promise<Response> {
  const url = new URL(req.url)
  const sessionId = url.searchParams.get('session_id')

  if (!sessionId)
    throw new AppError(400, 'No session id')

  const token = authSessions.get(sessionId)
  if (token) {
    authSessions.delete(sessionId)
    return json({ status: 'success', token })
  }

  return json({ status: 'pending' })
}
