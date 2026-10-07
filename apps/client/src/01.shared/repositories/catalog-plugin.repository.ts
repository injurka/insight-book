import type { CatalogPluginRecord, UploadProgress } from '~/01.shared/types/models'
import { z } from 'zod'
import { applyAcl } from '~/01.shared/lib/acl'
import { api } from '~/01.shared/services/api.service'
import { CatalogPluginRecordSchema } from '~/01.shared/types/schemas/catalog-plugin.schema'

export interface ICatalogPluginRepository {
  getApproved: () => Promise<CatalogPluginRecord[]>
  getMy: () => Promise<CatalogPluginRecord[]>
  getPending: () => Promise<CatalogPluginRecord[]>
  upload: (file: File, pluginId?: string, onUploadProgress?: (progress: UploadProgress) => void) => Promise<CatalogPluginRecord>
  updateStatus: (id: string, version: string, status: 'approved' | 'rejected') => Promise<CatalogPluginRecord>
  delete: (id: string) => Promise<{ success: boolean }>
  deleteVersion: (id: string, version: string) => Promise<{ success: boolean }>
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

  async upload(file: File, pluginId?: string, onUploadProgress?: (progress: UploadProgress) => void) {
    return api.catalogPlugins.upload(file, pluginId, onUploadProgress)
  }

  async updateStatus(id: string, version: string, status: 'approved' | 'rejected') {
    return api.catalogPlugins.updateStatus(id, version, status)
  }

  async delete(id: string) {
    return api.catalogPlugins.delete(id)
  }

  async deleteVersion(id: string, version: string) {
    return api.catalogPlugins.deleteVersion(id, version)
  }
}

export const catalogPluginRepository: ICatalogPluginRepository = new DefaultCatalogPluginRepository()
