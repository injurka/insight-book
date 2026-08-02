import type { UserPluginRecord } from '~/01.shared/types/models'
import { z } from 'zod'
import { applyAcl } from '~/01.shared/lib/acl'
import { api } from '~/01.shared/services/api.service'
import { UserPluginRecordSchema } from '~/01.shared/types/schemas/plugin.schema'

export interface IPluginRepository {
  getMyPlugins: () => Promise<UserPluginRecord[]>
  installPlugin: (data: { pluginId: string, manifestUrl: string, settings?: string | null, isEnabled?: boolean }) => Promise<UserPluginRecord>
  updatePlugin: (pluginId: string, data: { isEnabled?: boolean, settings?: string | null }) => Promise<UserPluginRecord>
  uninstallPlugin: (pluginId: string) => Promise<{ success: boolean }>
}

export class DefaultPluginRepository implements IPluginRepository {
  async getMyPlugins() {
    const raw = await api.plugins.getMyPlugins()

    return applyAcl(z.array(UserPluginRecordSchema), raw, 'plugin.getMyPlugins()')
  }

  async installPlugin(data: { pluginId: string, manifestUrl: string, settings?: string | null, isEnabled?: boolean }) {
    return api.plugins.installPlugin(data)
  }

  async updatePlugin(pluginId: string, data: { isEnabled?: boolean, settings?: string | null }) {
    return api.plugins.updatePlugin(pluginId, data)
  }

  async uninstallPlugin(pluginId: string) {
    return api.plugins.uninstallPlugin(pluginId)
  }
}

export const pluginRepository: IPluginRepository = new DefaultPluginRepository()
