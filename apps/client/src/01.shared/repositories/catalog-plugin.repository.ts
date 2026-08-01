import type { CatalogPluginRecord } from '~/01.shared/types/models'
import { z } from 'zod'
import { applyAcl } from '~/01.shared/lib/acl'
import { api } from '~/01.shared/services/api.service'
import { CatalogPluginRecordSchema } from '~/01.shared/types/schemas/catalog-plugin.schema'

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
    const raw = await api.catalogPlugins.getApproved()
    return applyAcl(z.array(CatalogPluginRecordSchema), raw, 'catalogPlugin.getApproved()')
  }

  async getMy() {
    const raw = await api.catalogPlugins.getMy()
    return applyAcl(z.array(CatalogPluginRecordSchema), raw, 'catalogPlugin.getMy()')
  }

  async getPending() {
    const raw = await api.catalogPlugins.getPending()
    return applyAcl(z.array(CatalogPluginRecordSchema), raw, 'catalogPlugin.getPending()')
  }

  async upload(file: File) {
    return api.catalogPlugins.upload(file)
  }

  async updateStatus(id: number, status: 'approved' | 'rejected') {
    return api.catalogPlugins.updateStatus(id, status)
  }

  async delete(id: number) {
    return api.catalogPlugins.delete(id)
  }
}

export const catalogPluginRepository: ICatalogPluginRepository = new DefaultCatalogPluginRepository()
