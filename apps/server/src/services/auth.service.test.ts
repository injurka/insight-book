import type { users } from '../db/schema'
import type { IUserRepository } from '../repositories/interfaces'
import { beforeEach, describe, expect, it, mock } from 'bun:test'
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

    const result = await authService.unlinkProvider(1, 'yandex')
    expect(result.success).toBe(true)
    expect(result.user.isYandexLinked).toBe(false)
    expect(mockUserRepo.updateUser).toHaveBeenCalledWith(1, { yandexId: null })
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

    await expect(authService.unlinkProvider(1, 'yandex')).rejects.toThrow('Нельзя отвязать единственный способ входа в аккаунт')
  })
})
