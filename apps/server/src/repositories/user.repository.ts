import type { IUserRepository } from './interfaces'
import { eq, sql } from 'drizzle-orm'
import { db } from '../db'
import * as schema from '../db/schema'

export class UserRepository implements IUserRepository {
  async findById(id: number) {
    return db.query.users.findFirst({ where: eq(schema.users.id, id) })
  }

  async findByLogin(login: string) {
    return db.query.users.findFirst({
      where: sql`${schema.users.username} = ${login} OR ${schema.users.email} = ${login}`,
    })
  }

  async findByEmail(email: string) {
    return db.query.users.findFirst({ where: eq(schema.users.email, email) })
  }

  async findByUsername(username: string) {
    return db.query.users.findFirst({ where: eq(schema.users.username, username) })
  }

  async findByYandexId(yandexId: string) {
    return db.query.users.findFirst({ where: eq(schema.users.yandexId, yandexId) })
  }

  async createUser(data: typeof schema.users.$inferInsert) {
    const [user] = await db.insert(schema.users).values(data).returning()
    return user
  }

  async updateUser(id: number, data: Partial<typeof schema.users.$inferInsert>) {
    const [user] = await db.update(schema.users).set(data).where(eq(schema.users.id, id)).returning()
    return user
  }

  async getUsedBooksCount(userId: number, periodStart: string) {
    const [{ count }] = await db.select({ count: sql<number>`count(*)` })
      .from(schema.books)
      .where(sql`${schema.books.userId} = ${userId} AND datetime(${schema.books.createdAt}) >= datetime(${periodStart})`)
    return count
  }

  async getTotalTokens(userId: number, periodStart: string) {
    const [{ totalTokens }] = await db.select({
      totalTokens: sql<number>`COALESCE(SUM(${schema.tokenUsage.inputTokens} + ${schema.tokenUsage.outputTokens}), 0)`.mapWith(Number),
    })
      .from(schema.tokenUsage)
      .where(sql`${schema.tokenUsage.userId} = ${userId} AND date(${schema.tokenUsage.date}) >= date(${periodStart})`)
    return totalTokens
  }

  async createEmailConfirmation(email: string, code: string) {
    await db.insert(schema.emailConfirmations).values({ email, code })
  }

  async findEmailConfirmation(email: string, code: string) {
    return db.query.emailConfirmations.findFirst({
      where: sql`${schema.emailConfirmations.email} = ${email} AND ${schema.emailConfirmations.code} = ${code}`,
      orderBy: (c, { desc }) => [desc(c.createdAt)],
    })
  }

  async deleteEmailConfirmations(email: string) {
    await db.delete(schema.emailConfirmations).where(eq(schema.emailConfirmations.email, email))
  }
}

export const userRepository = new UserRepository()
