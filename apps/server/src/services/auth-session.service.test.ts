import { createClient } from '@libsql/client'
import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { eq, sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/libsql'
import { getTableConfig, SQLiteSyncDialect } from 'drizzle-orm/sqlite-core'
import jwt from 'jsonwebtoken'
import { JWT_SECRET } from '../config'
import * as schema from '../db/schema'
import { AuthSessionRepository } from '../repositories/auth-session.repository'
import { AuthSessionService } from './auth-session.service'

const client = createClient({ url: 'file::memory:' })
const database = drizzle(client, { schema })
const service = new AuthSessionService(new AuthSessionRepository(database))

beforeAll(async () => {
  const dialect = new SQLiteSyncDialect()

  for (const table of [schema.users, schema.authSessions]) {
    const config = getTableConfig(table)
    const columns = config.columns.map((column) => {
      const defaultValue = column.default === undefined ? '' : ` DEFAULT ${dialect.sqlToQuery(sql`${column.default}`.inlineParams()).sql}`

      return `"${column.name}" ${column.getSQLType()}${column.primary ? ' PRIMARY KEY' : ''}${defaultValue}`
    })
    await database.run(sql.raw(`CREATE TABLE "${config.name}" (${columns.join(',')})`))
  }

  await database.insert(schema.users).values({ id: 1, username: 'session-test', passwordHash: 'test' })
})
afterAll(() => client.close())

describe('Rotating desktop sessions', () => {
  it('issues short access tokens and stores only a hash of the refresh token', async () => {
    const session = await service.create(1)
    const payload = jwt.verify(session.accessToken, JWT_SECRET) as jwt.JwtPayload
    expect(payload.userId).toBe(1)
    expect(payload.exp! - payload.iat!).toBe(900)
    const rows = await database.select().from(schema.authSessions)
    expect(rows.some(row => row.tokenHash === session.refreshToken)).toBe(false)
    expect(rows.some(row => row.tokenHash === new Bun.CryptoHasher('sha256').update(session.refreshToken).digest('hex'))).toBe(true)
  })
  it('rotates refresh tokens exactly once and revokes on logout', async () => {
    const initial = await service.create(1)
    const rotated = await service.refresh(initial.refreshToken)
    expect(rotated.refreshToken).not.toBe(initial.refreshToken)
    expect(rotated.accessToken).not.toBe(initial.accessToken)
    expect((jwt.verify(rotated.accessToken, JWT_SECRET) as jwt.JwtPayload).userId).toBe(1)
    await expect(service.refresh(initial.refreshToken)).rejects.toThrow('Refresh session expired or revoked')
    await service.revoke(rotated.refreshToken)
    await expect(service.refresh(rotated.refreshToken)).rejects.toThrow('Refresh session expired or revoked')
  })
  it('rejects expired refresh sessions', async () => {
    const session = await service.create(1)
    const hash = new Bun.CryptoHasher('sha256').update(session.refreshToken).digest('hex')
    await database.update(schema.authSessions).set({ expiresAt: Date.now() - 1 }).where(eq(schema.authSessions.tokenHash, hash))
    await expect(service.refresh(session.refreshToken)).rejects.toThrow('Refresh session expired or revoked')
  })
})
