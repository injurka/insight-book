import type { DashboardStats, PaginatedResponse, PendingBook, PendingPlugin, SubscriptionTier, UserDetail, UserRow } from '~/01.shared/types/models'
import { api } from '~/01.shared/lib/api'

export interface IAdminRepository {
  stats: () => Promise<DashboardStats>
  getSubscriptionTiers: () => Promise<SubscriptionTier[]>
  listUsers: (opts?: { page?: number, limit?: number, search?: string }) => Promise<PaginatedResponse<UserRow>>
  getUser: (id: number) => Promise<UserDetail>
  createUser: (data: { username: string, password: string, role?: string, email?: string | null, subscriptionTier?: string, tokenLimit?: number, bookLimit?: number }) => Promise<{ success: boolean, user: Record<string, unknown> }>
  updateUser: (id: number, data: Record<string, unknown>) => Promise<{ success: boolean, user: Record<string, unknown> | null }>
  deleteUser: (id: number) => Promise<{ success: boolean }>
  pendingBooks: () => Promise<PendingBook[]>
  setBookStatus: (id: number, status: 'approved' | 'rejected') => Promise<{ success: boolean }>
  pendingPlugins: () => Promise<PendingPlugin[]>
  setPluginStatus: (id: string, status: 'approved' | 'rejected') => Promise<Record<string, unknown>>
}

export class DefaultAdminRepository implements IAdminRepository {
  async stats() { return api.admin.stats() }
  async getSubscriptionTiers() { return api.admin.getSubscriptionTiers() }
  async listUsers(opts?: { page?: number, limit?: number, search?: string }) { return api.admin.listUsers(opts) }
  async getUser(id: number) { return api.admin.getUser(id) }
  async createUser(data: Parameters<IAdminRepository['createUser']>[0]) { return api.admin.createUser(data) }
  async updateUser(id: number, data: Record<string, unknown>) { return api.admin.updateUser(id, data) }
  async deleteUser(id: number) { return api.admin.deleteUser(id) }
  async pendingBooks() { return api.admin.pendingBooks() }
  async setBookStatus(id: number, status: 'approved' | 'rejected') { return api.admin.setBookStatus(id, status) }
  async pendingPlugins() { return api.admin.pendingPlugins() }
  async setPluginStatus(id: string, status: 'approved' | 'rejected') { return api.admin.setPluginStatus(id, status) }
}

export const adminRepository: IAdminRepository = new DefaultAdminRepository()
