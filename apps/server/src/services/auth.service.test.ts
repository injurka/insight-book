import type { users } from '../db/schema'
import type { IUserRepository } from '../repositories/interfaces'
import { beforeEach, describe, expect, it, mock, spyOn } from 'bun:test'
import { AuthService } from './auth.service'

describe('AuthService - OAuth Linking & Unlinking', () => {
  let mockUserRepo: IUserRepository
  let authService: AuthService

  beforeEach(() => {
    mockUserRepo = {
      findById: mock(async (id: number) => {
        if (id === 1) {
          return {
            id: 1,
            username: 'testuser',
            passwordHash: 'hash123',
            email: 'test@example.com',
            yandexId: null,
            role: 'user',
            subscriptionTier: 'free',
            tokenLimit: 100000,
            bookLimit: 3,
            usedTokens: 0,
            periodStart: new Date().toISOString(),
            createdAt: new Date().toISOString(),
            pushTargetDeckId: null,
            pushTimeStart: '10:00',
            pushTimeEnd: '21:00',
            pushCount: 1,
            timezone: 'UTC',
            uiLanguage: 'ru',
            lastPushSentAt: null,
            avatarUrl: null,
          }
        }

        return null
      }),
      findByLogin: mock(async () => null),
      findByEmail: mock(async () => null),
      findByUsername: mock(async () => null),
      findByYandexId: mock(async (yandexId: string) => {
        if (yandexId === 'already_used_id') {
          return {
            id: 2,
            username: 'otheruser',
            passwordHash: 'hash456',
            email: 'other@example.com',
            yandexId: 'already_used_id',
            role: 'user',
            subscriptionTier: 'free',
            tokenLimit: 100000,
            bookLimit: 3,
            usedTokens: 0,
            periodStart: new Date().toISOString(),
            createdAt: new Date().toISOString(),
            pushTargetDeckId: null,
            pushTimeStart: '10:00',
            pushTimeEnd: '21:00',
            pushCount: 1,
            timezone: 'UTC',
            uiLanguage: 'ru',
            lastPushSentAt: null,
            avatarUrl: null,
          }
        }

        return null
      }),
      createUser: mock(async (data: typeof users.$inferInsert) => ({ id: 3, ...data })),
      updateUser: mock(async (id: number, data: Partial<typeof users.$inferInsert>) => ({
        id,
        username: 'testuser',
        passwordHash: 'hash123',
        email: 'test@example.com',
        yandexId: data.yandexId !== undefined ? data.yandexId : null,
        role: 'user',
        subscriptionTier: 'free',
        tokenLimit: 100000,
        bookLimit: 3,
        usedTokens: 0,
        periodStart: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        pushTargetDeckId: null,
        pushTimeStart: '10:00',
        pushTimeEnd: '21:00',
        pushCount: 1,
        timezone: 'UTC',
        uiLanguage: 'ru',
        lastPushSentAt: null,
        avatarUrl: data.avatarUrl || null,
      })),
      getUsedBooksCount: mock(async () => 0),
      getTotalTokens: mock(async () => 0),
      createEmailConfirmation: mock(async () => {}),
      findEmailConfirmation: mock(async () => null),
      deleteEmailConfirmations: mock(async () => {}),
      count: mock(async () => 1),
      countByRole: mock(async () => 1),
      list: mock(async () => ({ users: [], total: 0 })),
      delete: mock(async () => {}),
    } as unknown as IUserRepository

    authService = new AuthService(mockUserRepo)
  })

  it('unlinks Yandex provider when user has email login method', async () => {
    mockUserRepo.findById = mock(async () => ({
      id: 1,
      username: 'testuser',
      passwordHash: 'hash123',
      email: 'test@example.com',
      yandexId: 'yandex_12345',
      role: 'user',
      subscriptionTier: 'free',
      tokenLimit: 100000,
      bookLimit: 3,
      usedTokens: 0,
      periodStart: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      pushTargetDeckId: null,
      pushTimeStart: '10:00',
      pushTimeEnd: '21:00',
      pushCount: 1,
      timezone: 'UTC',
      uiLanguage: 'ru',
      lastPushSentAt: null,
      avatarUrl: null,
    }))

    const user = (await mockUserRepo.findById(1))!
    const passwordHash = await Bun.password.hash('current-password', { algorithm: 'bcrypt', cost: 4 })
    mockUserRepo.findById = mock(async () => ({ ...user, passwordHash }))
    mockUserRepo.updateYandexLink = mock(async () => ({ ...user, yandexId: null, passwordHash }))

    await expect(authService.unlinkProvider(1, 'yandex', 'wrong-password')).rejects.toThrow('Confirm a working InsightBook password')
    expect(mockUserRepo.updateYandexLink).not.toHaveBeenCalled()

    const result = await authService.unlinkProvider(1, 'yandex', 'current-password')
    expect(result.success).toBe(true)
    expect(result.user.isYandexLinked).toBe(false)
    expect(mockUserRepo.updateYandexLink).toHaveBeenCalledWith(1, 'yandex_12345', { yandexId: null })
  })

  it('throws error when unlinking if provider is not linked', async () => {
    await expect(authService.unlinkProvider(1, 'yandex')).rejects.toThrow('Этот аккаунт не привязан.')
  })

  it('throws error when user tries to unlink the only authentication method', async () => {
    mockUserRepo.findById = mock(async () => ({
      id: 1,
      username: 'testuser',
      passwordHash: 'dummy',
      email: null,
      yandexId: 'yandex_12345',
      role: 'user',
      subscriptionTier: 'free',
      tokenLimit: 100000,
      bookLimit: 3,
      usedTokens: 0,
      periodStart: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      pushTargetDeckId: null,
      pushTimeStart: '10:00',
      pushTimeEnd: '21:00',
      pushCount: 1,
      timezone: 'UTC',
      uiLanguage: 'ru',
      lastPushSentAt: null,
      avatarUrl: null,
    }))

    await expect(authService.unlinkProvider(1, 'yandex')).rejects.toThrow('Confirm a working InsightBook password')
  })
  it('requires explicit linking for a matching email and preserves existing Yandex links', async () => {
    const user = (await mockUserRepo.findById(1))!
    mockUserRepo.findByEmail = mock(async () => user)
    mockUserRepo.updateYandexLink = mock(async () => user)
    const fetch = spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(Response.json({ access_token: 'test' }))
      .mockResolvedValueOnce(Response.json({ id: 'new-id', default_email: user.email }))
      .mockResolvedValueOnce(Response.json({ access_token: 'test' }))
      .mockResolvedValueOnce(Response.json({ id: 'new-id', default_email: user.email }))

    try {
      await expect(authService.exchangeYandexCode('code')).rejects.toMatchObject({ code: 'EMAIL_ALREADY_EXISTS' })
      mockUserRepo.findById = mock(async () => ({ ...user, yandexId: 'previous-id' }))
      await expect(authService.linkYandex(1, 'code')).rejects.toMatchObject({ code: 'OAUTH_ALREADY_LINKED' })
      expect(mockUserRepo.updateYandexLink).not.toHaveBeenCalled()
    }
    finally {
      fetch.mockRestore()
    }
  })

  it('rejects a malformed Yandex identity before accessing the user repository', async () => {
    const fetch = spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(Response.json({ access_token: 'test' }))
      .mockResolvedValueOnce(Response.json({ default_email: 'test@example.com' }))

    try {
      await expect(authService.exchangeYandexCode('code')).rejects.toMatchObject({ code: 'OAUTH_USER_INFO_FAILED' })
      expect(mockUserRepo.findByYandexId).not.toHaveBeenCalled()
    }
    finally {
      fetch.mockRestore()
    }
  })
})
