import type { IUserRepository } from '../repositories/interfaces'
import path from 'node:path'
import jwt from 'jsonwebtoken'
import { AUTH_MODE, FRONTEND_URL, JWT_SECRET, UNISENDER_API_KEY, YANDEX_CLIENT_ID, YANDEX_CLIENT_SECRET } from '../config'
import { ERROR_CODES } from '../constants/error-codes'
import { ROLES } from '../constants/roles'
import { userRepository } from '../repositories/user.repository'
import { AppError } from '../utils/errors'
import { logger } from '../utils/logger'
import { storageService } from './storage.service'

type DbUser = NonNullable<Awaited<ReturnType<IUserRepository['findById']>>>

export class AuthService {
  constructor(private userRepo: IUserRepository = userRepository) {}
  async getUserPayload(user: DbUser) {
    const usedBooks = await this.userRepo.getUsedBooksCount(user.id, user.periodStart)
    const totalTokens = await this.userRepo.getTotalTokens(user.id, user.periodStart)

    if (user.usedTokens !== totalTokens) {
      await this.userRepo.updateUser(user.id, { usedTokens: totalTokens }).catch(logger.error)
    }

    return {
      id: user.id,
      username: user.username,
      email: user.email,
      yandexId: user.yandexId,
      isYandexLinked: Boolean(user.yandexId),
      hasPassword: Boolean(user.email && user.passwordHash),
      role: user.role,
      subscriptionTier: user.subscriptionTier || 'free',
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

  async login(login: string, passwordString: string) {
    if (AUTH_MODE === 'single') {
      const user = await this.userRepo.findById(1)
      if (user) {
        const userPayload = await this.getUserPayload(user)
        return { token: 'dummy-token', user: userPayload }
      }
      return { token: 'dummy-token', user: { id: 1, username: 'admin', role: ROLES.ADMIN } }
    }

    const user = await this.userRepo.findByLogin(login)
    if (!user)
      throw new AppError(401, ERROR_CODES.AUTH.INVALID_CREDENTIALS, 'Invalid credentials')

    const isMatch = await Bun.password.verify(passwordString, user.passwordHash)
    if (!isMatch)
      throw new AppError(401, ERROR_CODES.AUTH.INVALID_CREDENTIALS, 'Invalid credentials')

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '30d' })
    const userPayload = await this.getUserPayload(user)

    return { token, user: userPayload }
  }

  async sendCode(email: string) {
    const existingUser = await this.userRepo.findByEmail(email)
    if (existingUser)
      throw new AppError(400, ERROR_CODES.AUTH.EMAIL_ALREADY_EXISTS, 'User with this email already exists')

    const code = Math.floor(100000 + Math.random() * 900000).toString()
    await this.userRepo.createEmailConfirmation(email, code)

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
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
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
        logger.error(jsonRes, 'Unisender Go error:')
        const errorMessage = jsonRes.message || (jsonRes.errors && jsonRes.errors[0]?.message) || 'Неизвестная ошибка'
        throw new AppError(500, ERROR_CODES.SYSTEM.EMAIL_SEND_FAILED, `Email send failed: ${errorMessage}`)
      }
    }
    else {
      logger.warn(`[DEV] Registration code for ${email}: ${code}`)
    }

    return { success: true, message: 'Код отправлен на почту' }
  }

  async register(email: string, code: string, passwordString: string) {
    const confirmation = await this.userRepo.findEmailConfirmation(email, code)
    if (!confirmation)
      throw new AppError(400, ERROR_CODES.AUTH.INVALID_VERIFICATION_CODE, 'Invalid verification code')

    const createdAt = new Date(`${confirmation.createdAt}Z`).getTime()
    if (Date.now() - createdAt > 15 * 60 * 1000)
      throw new AppError(400, ERROR_CODES.AUTH.VERIFICATION_CODE_EXPIRED, 'Verification code expired')

    let randomUsername = `user_${Math.random().toString(36).substring(2, 8)}`
    let existingUser = await this.userRepo.findByUsername(randomUsername)
    while (existingUser) {
      randomUsername = `user_${Math.random().toString(36).substring(2, 8)}`
      existingUser = await this.userRepo.findByUsername(randomUsername)
    }

    const passwordHash = await Bun.password.hash(passwordString)
    const newUser = await this.userRepo.createUser({ email, username: randomUsername, passwordHash })

    await this.userRepo.deleteEmailConfirmations(email)

    const token = jwt.sign({ userId: newUser.id }, JWT_SECRET, { expiresIn: '30d' })
    const userPayload = await this.getUserPayload(newUser)

    return { token, user: userPayload }
  }

  async getMe(userId: number | null) {
    if (userId === null)
      return { user: null, mode: AUTH_MODE }
    const user = await this.userRepo.findById(userId)
    if (!user)
      throw new AppError(404, ERROR_CODES.USER.NOT_FOUND, 'User not found')
    return { user: await this.getUserPayload(user), mode: AUTH_MODE }
  }

  async updateAvatar(userId: number, file: File) {
    const user = await this.userRepo.findById(userId)
    const buffer = await file.arrayBuffer()
    const ext = path.extname(file.name).toLowerCase() || '.jpg'
    const filename = `${Date.now()}_avatar_${userId}${ext}`

    if (user?.avatarUrl && user.avatarUrl.startsWith('/api/uploads/avatars/')) {
      const oldFilename = user.avatarUrl.split('/').pop()
      if (oldFilename)
        await storageService.deleteFile(`avatars/${oldFilename}`)
    }
    await storageService.uploadFile(`avatars/${filename}`, buffer, `image/${ext.slice(1)}`)

    const avatarUrl = `/api/uploads/avatars/${filename}`
    await this.userRepo.updateUser(userId, { avatarUrl })
    return { success: true, avatarUrl }
  }

  async getAvatarImage(filename: string) {
    const key = `avatars/${filename}`
    return await storageService.getFile(key)
  }

  async updateUsername(userId: number, username: string) {
    if (!username || username.trim().length < 2)
      throw new AppError(400, ERROR_CODES.AUTH.INVALID_USERNAME, 'Invalid username')
    const newUsername = username.trim()

    const existing = await this.userRepo.findByUsername(newUsername)
    if (existing && existing.id !== userId)
      throw new AppError(400, ERROR_CODES.AUTH.USERNAME_TAKEN, 'Username taken')

    await this.userRepo.updateUser(userId, { username: newUsername })
    return { success: true, username: newUsername }
  }

  async handleYandexAuth(state?: string) {
    const url = new URL('https://oauth.yandex.ru/authorize')
    url.searchParams.set('response_type', 'code')
    url.searchParams.set('client_id', YANDEX_CLIENT_ID)
    url.searchParams.set('redirect_uri', `${FRONTEND_URL}/api/auth/yandex/callback`)
    if (state)
      url.searchParams.set('state', state)
    return { redirectUrl: url.toString() }
  }

  private async fetchYandexUserData(code: string) {
    const WEB_REDIRECT_URI = `${FRONTEND_URL}/api/auth/yandex/callback`
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
      throw new AppError(400, ERROR_CODES.AUTH.OAUTH_TOKEN_EXCHANGE_FAILED, `Failed to exchange token: ${errText}`)
    }
    const tokenData = (await tokenRes.json()) as { access_token: string }

    const userRes = await fetch('https://login.yandex.ru/info?format=json', {
      headers: { Authorization: `OAuth ${tokenData.access_token}` },
    })
    if (!userRes.ok)
      throw new AppError(400, ERROR_CODES.AUTH.OAUTH_USER_INFO_FAILED, 'Failed to fetch user info')

    return (await userRes.json()) as {
      id: string | number
      login?: string
      default_email?: string
      emails?: string[]
      default_avatar_id?: string
      is_avatar_empty?: boolean
    }
  }

  async exchangeYandexCode(code: string) {
    const userData = await this.fetchYandexUserData(code)
    const yandexId = String(userData.id)
    let user = await this.userRepo.findByYandexId(yandexId)

    if (!user) {
      const email = userData.default_email || userData.emails?.[0] || null
      if (email) {
        const userWithEmail = await this.userRepo.findByEmail(email)
        if (userWithEmail) {
          user = await this.userRepo.updateUser(userWithEmail.id, { yandexId })
        }
      }

      if (!user) {
        let proposedUsername = userData.login || `yandex_${yandexId}`
        const existing = await this.userRepo.findByUsername(proposedUsername)
        if (existing)
          proposedUsername = `yandex_${yandexId}_${Date.now()}`

        const dummyPassword = await Bun.password.hash(crypto.randomUUID())
        user = await this.userRepo.createUser({
          email: email || undefined,
          yandexId,
          username: proposedUsername,
          passwordHash: dummyPassword,
          avatarUrl: (userData.default_avatar_id && !userData.is_avatar_empty)
            ? `https://avatars.yandex.net/get-yapic/${userData.default_avatar_id}/islands-200`
            : null,
        })
      }
    }

    if (!user)
      throw new AppError(500, ERROR_CODES.SYSTEM.INTERNAL_SERVER_ERROR, 'Failed to authenticate user')

    return jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '30d' })
  }

  async linkYandex(userId: number, code: string) {
    const userData = await this.fetchYandexUserData(code)
    const yandexId = String(userData.id)

    const existing = await this.userRepo.findByYandexId(yandexId)
    if (existing) {
      if (existing.id === userId) {
        return this.userRepo.findById(userId)
      }
      throw new AppError(400, ERROR_CODES.AUTH.OAUTH_ALREADY_LINKED, 'Этот аккаунт Яндекс уже привязан к другому пользователю.')
    }

    const currentUser = await this.userRepo.findById(userId)
    if (!currentUser)
      throw new AppError(404, ERROR_CODES.USER.NOT_FOUND, 'User not found')

    const updatePayload: { yandexId: string, avatarUrl?: string } = { yandexId }
    if (!currentUser.avatarUrl && userData.default_avatar_id && !userData.is_avatar_empty) {
      updatePayload.avatarUrl = `https://avatars.yandex.net/get-yapic/${userData.default_avatar_id}/islands-200`
    }

    return this.userRepo.updateUser(userId, updatePayload)
  }

  async unlinkProvider(userId: number, provider: string) {
    if (provider !== 'yandex')
      throw new AppError(400, ERROR_CODES.SYSTEM.VALIDATION_ERROR, 'Неподдерживаемый провайдер')

    const user = await this.userRepo.findById(userId)
    if (!user)
      throw new AppError(404, ERROR_CODES.USER.NOT_FOUND, 'User not found')

    if (!user.yandexId)
      throw new AppError(400, ERROR_CODES.AUTH.OAUTH_NOT_LINKED, 'Этот аккаунт не привязан.')

    if (!user.email)
      throw new AppError(400, ERROR_CODES.AUTH.CANNOT_UNLINK_LAST_AUTH, 'Нельзя отвязать единственный способ входа в аккаунт. Сначала укажите почту или другой способ входа.')

    const updatedUser = await this.userRepo.updateUser(userId, { yandexId: null })
    if (!updatedUser)
      throw new AppError(500, ERROR_CODES.SYSTEM.INTERNAL_SERVER_ERROR, 'Failed to update user')

    return {
      success: true,
      user: await this.getUserPayload(updatedUser),
    }
  }
}

export const authService = new AuthService()
