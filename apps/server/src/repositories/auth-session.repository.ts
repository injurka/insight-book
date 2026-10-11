import { and, eq, gt, lte } from 'drizzle-orm'
import { db } from '../db'
import { authSessions } from '../db/schema'

export class AuthSessionRepository {
  constructor(private database: typeof db = db) {}

  async create(userId: number, tokenHash: string, expiresAt: number) {
    await this.database.delete(authSessions).where(lte(authSessions.expiresAt, Date.now()))
    await this.database.insert(authSessions).values({ userId, tokenHash, expiresAt })
  }

  async rotate(tokenHash: string, nextHash: string, expiresAt: number) {
    return this.database.transaction(async (tx) => {
      const [session] = await tx.delete(authSessions).where(and(
        eq(authSessions.tokenHash, tokenHash),
        gt(authSessions.expiresAt, Date.now()),
      )).returning({ userId: authSessions.userId })
      if (!session)
        return null
      await tx.insert(authSessions).values({ userId: session.userId, tokenHash: nextHash, expiresAt })
      return session.userId
    })
  }

  async revoke(tokenHash: string) {
    await this.database.delete(authSessions).where(eq(authSessions.tokenHash, tokenHash))
  }
}

export const authSessionRepository = new AuthSessionRepository()
