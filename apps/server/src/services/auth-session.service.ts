import jwt from 'jsonwebtoken'
import { JWT_SECRET } from '../config'
import { ERROR_CODES } from '../constants/error-codes'
import { authSessionRepository } from '../repositories/auth-session.repository'
import { AppError } from '../utils/errors'

const ACCESS_SECONDS = 15 * 60
const REFRESH_MS = 90 * 24 * 60 * 60 * 1000

function refreshToken() {
  return Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64url')
}

function hash(token: string) {
  return new Bun.CryptoHasher('sha256').update(token).digest('hex')
}

export class AuthSessionService {
  constructor(private repository = authSessionRepository) {}

  private tokens(userId: number, refresh: string) {
    return {
      accessToken: jwt.sign({ userId }, JWT_SECRET, { expiresIn: ACCESS_SECONDS, jwtid: crypto.randomUUID() }),
      refreshToken: refresh,
      expiresIn: ACCESS_SECONDS,
    }
  }

  async create(userId: number) {
    const refresh = refreshToken()
    await this.repository.create(userId, hash(refresh), Date.now() + REFRESH_MS)

    return this.tokens(userId, refresh)
  }

  async refresh(token: string) {
    const next = refreshToken()
    const userId = await this.repository.rotate(hash(token), hash(next), Date.now() + REFRESH_MS)

    if (!userId)
      throw new AppError(401, ERROR_CODES.AUTH.INVALID_TOKEN, 'Refresh session expired or revoked')

    return this.tokens(userId, next)
  }

  async revoke(token: string) {
    await this.repository.revoke(hash(token))

    return { success: true }
  }
}

export const authSessionService = new AuthSessionService()
