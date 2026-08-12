import { ERROR_CODES } from '../constants/error-codes'
import { ROLES } from '../constants/roles'
import { bookRepository } from '../repositories/book.repository'
import { catalogPluginRepository } from '../repositories/catalog-plugin.repository'
import { userRepository } from '../repositories/user.repository'
import { AppError } from '../utils/errors'
import { logger } from '../utils/logger'

export class AdminService {
  /** Проверка, что пользователь — админ */
  async assertAdmin(userId: number) {
    const user = await userRepository.findById(userId)
    if (!user || user.role !== ROLES.ADMIN) {
      throw new AppError(403, ERROR_CODES.AUTH.FORBIDDEN, 'Forbidden')
    }
  }

  async getStats(userId: number) {
    await this.assertAdmin(userId)

    const [totalUsers, totalBooks, pendingPlugins, pendingBooks] = await Promise.all([
      userRepository.count(),
      bookRepository.count(),
      catalogPluginRepository.countPending(),
      bookRepository.countPendingPublic(),
    ])

    return {
      totalUsers,
      totalBooks,
      pendingPlugins,
      pendingBooks,
    }
  }

  async listUsers(userId: number, opts: { page?: number, limit?: number, search?: string }) {
    await this.assertAdmin(userId)

    const page = Math.max(1, opts.page || 1)
    const limit = Math.max(1, Math.min(100, opts.limit || 20))
    const offset = (page - 1) * limit

    const { users, total } = await userRepository.list({ limit, offset, search: opts.search })

    return {
      data: users,
      total,
      page,
      limit,
    }
  }

  async getUserDetail(adminUserId: number, targetUserId: number) {
    await this.assertAdmin(adminUserId)

    const user = await userRepository.findById(targetUserId)
    if (!user) {
      throw new AppError(404, ERROR_CODES.USER.NOT_FOUND, 'User not found')
    }

    const usedBooks = await userRepository.getUsedBooksCount(user.id, user.periodStart)
    const totalTokens = await userRepository.getTotalTokens(user.id, user.periodStart)

    return {
      ...user,
      passwordHash: undefined,
      usedBooks,
      usedTokens: totalTokens,
    }
  }

  async createUser(adminUserId: number, data: { username: string, password: string, role?: string, email?: string | null, subscriptionTier?: string, tokenLimit?: number, bookLimit?: number }) {
    await this.assertAdmin(adminUserId)

    const existing = await userRepository.findByUsername(data.username)
    if (existing) {
      throw new AppError(400, ERROR_CODES.AUTH.USER_ALREADY_EXISTS, 'User already exists')
    }

    if (data.email) {
      const emailExists = await userRepository.findByEmail(data.email)
      if (emailExists) {
        throw new AppError(400, ERROR_CODES.AUTH.EMAIL_ALREADY_EXISTS, 'Email already exists')
      }
    }

    const passwordHash = await Bun.password.hash(data.password)

    const user = await userRepository.createUser({
      username: data.username,
      passwordHash,
      email: data.email || null,
      role: data.role || ROLES.USER,
      subscriptionTier: data.subscriptionTier || 'free',
      tokenLimit: data.tokenLimit ?? 100000,
      bookLimit: data.bookLimit ?? 3,
    })

    logger.info(`[Admin] User "${data.username}" created by admin ${adminUserId}`)

    return { success: true, user: { ...user, passwordHash: undefined } }
  }

  async updateUser(adminUserId: number, targetUserId: number, data: { role?: string, subscriptionTier?: string, tokenLimit?: number, bookLimit?: number, username?: string, email?: string | null, password?: string }) {
    await this.assertAdmin(adminUserId)

    const user = await userRepository.findById(targetUserId)
    if (!user) {
      throw new AppError(404, ERROR_CODES.USER.NOT_FOUND, 'User not found')
    }

    // Защита: нельзя менять роль последнему админу
    if (data.role && data.role !== ROLES.ADMIN && user.role === ROLES.ADMIN) {
      const adminCount = await userRepository.countByRole(ROLES.ADMIN)
      if (adminCount <= 1) {
        throw new AppError(400, ERROR_CODES.USER.CANNOT_DEMOTE_LAST_ADMIN, 'Cannot demote last admin')
      }
    }

    const updateData: Record<string, unknown> = {}

    if (data.role !== undefined)
      updateData.role = data.role
    if (data.subscriptionTier !== undefined)
      updateData.subscriptionTier = data.subscriptionTier
    if (data.tokenLimit !== undefined)
      updateData.tokenLimit = data.tokenLimit
    if (data.bookLimit !== undefined)
      updateData.bookLimit = data.bookLimit
    if (data.username !== undefined) {
      const existing = await userRepository.findByUsername(data.username)
      if (existing && existing.id !== targetUserId) {
        throw new AppError(400, ERROR_CODES.AUTH.USER_ALREADY_EXISTS, 'User already exists')
      }
      updateData.username = data.username
    }
    if (data.email !== undefined)
      updateData.email = data.email
    if (data.password !== undefined && data.password) {
      updateData.passwordHash = await Bun.password.hash(data.password)
    }

    if (Object.keys(updateData).length === 0) {
      throw new AppError(400, ERROR_CODES.SYSTEM.NO_DATA_TO_UPDATE, 'No data to update')
    }

    const updated = await userRepository.updateUser(targetUserId, updateData as Parameters<typeof userRepository.updateUser>[1])
    logger.info(`[Admin] User ${targetUserId} updated by admin ${adminUserId}: ${Object.keys(updateData).join(', ')}`)

    return { success: true, user: updated ? { ...updated, passwordHash: undefined } : null }
  }

  async deleteUser(adminUserId: number, targetUserId: number) {
    await this.assertAdmin(adminUserId)

    if (targetUserId === adminUserId) {
      throw new AppError(400, ERROR_CODES.USER.CANNOT_DELETE_SELF, 'Cannot delete self')
    }

    const user = await userRepository.findById(targetUserId)
    if (!user) {
      throw new AppError(404, ERROR_CODES.USER.NOT_FOUND, 'User not found')
    }

    if (user.role === ROLES.ADMIN) {
      const adminCount = await userRepository.countByRole(ROLES.ADMIN)
      if (adminCount <= 1) {
        throw new AppError(400, ERROR_CODES.USER.CANNOT_DELETE_LAST_ADMIN, 'Cannot delete last admin')
      }
    }

    await userRepository.delete(targetUserId)
    logger.info(`[Admin] User ${targetUserId} ("${user.username}") deleted by admin ${adminUserId}`)

    return { success: true }
  }

  async listPendingBooks(userId: number) {
    await this.assertAdmin(userId)

    return bookRepository.findPendingPublic()
  }

  async setBookPublicStatus(adminUserId: number, bookId: number, status: 'approved' | 'rejected') {
    await this.assertAdmin(adminUserId)

    const book = await bookRepository.findFirstBook(bookId)
    if (!book) {
      throw new AppError(404, ERROR_CODES.BOOK.NOT_FOUND, 'Book not found')
    }

    const newIsPublic = status === 'approved'

    await bookRepository.updateBook(bookId, {
      publicStatus: status,
      isPublic: newIsPublic,
    })

    logger.info(`[Admin] Book ${bookId} public status set to "${status}" by admin ${adminUserId}`)

    return { success: true, bookId, publicStatus: status, isPublic: newIsPublic }
  }
}

export const adminService = new AdminService()
