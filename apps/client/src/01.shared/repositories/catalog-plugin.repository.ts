import type { CatalogPluginRecord } from '~/01.shared/types/models'
import { api } from '~/01.shared/services/api.service'

export interface ICatalogPluginRepository {
  getApproved: () => Promise<CatalogPluginRecord[]>
  getMy: () => Promise<CatalogPluginRecord[]>
  getPending: () => Promise<CatalogPluginRecord[]>
  upload: (file: File) => Promise<CatalogPluginRecord>
  updateStatus: (id: number, status: 'approved' | 'rejected') => Promise<CatalogPluginRecord>
  delete: (id: number) => Promise<{ success: boolean }>
}

export class DefaultCatalogPluginRepository implements ICatalogPluginRepository {
  async getApproved() {
    return await api.catalogPlugins.getApproved()
  }

  async getMy() {
    return await api.catalogPlugins.getMy()
  }

  async getPending() {
    return await api.catalogPlugins.getPending()
  }

  async upload(file: File) {
    return await api.catalogPlugins.upload(file)
  }

  async updateStatus(id: number, status: 'approved' | 'rejected') {
    return await api.catalogPlugins.updateStatus(id, status)
  }

  async delete(id: number) {
    return await api.catalogPlugins.delete(id)
  }
}

export const catalogPluginRepository: ICatalogPluginRepository = new DefaultCatalogPluginRepository()
