import type { UserPluginRecord } from '~/shared/types/models'
import { api } from '~/shared/services/api.service'

export interface IPluginRepository {
  getMyPlugins: () => Promise<UserPluginRecord[]>
  installPlugin: (data: { pluginId: string, manifestUrl: string, settings?: string | null, isEnabled?: boolean }) => Promise<UserPluginRecord>
  updatePlugin: (pluginId: string, data: { isEnabled?: boolean, settings?: string | null }) => Promise<UserPluginRecord>
  uninstallPlugin: (pluginId: string) => Promise<{ success: boolean }>
}

export class DefaultPluginRepository implements IPluginRepository {
  async getMyPlugins() {
    return await api.plugins.getMyPlugins()
  }

  async installPlugin(data: { pluginId: string, manifestUrl: string, settings?: string | null, isEnabled?: boolean }) {
    return await api.plugins.installPlugin(data)
  }

  async updatePlugin(pluginId: string, data: { isEnabled?: boolean, settings?: string | null }) {
    return await api.plugins.updatePlugin(pluginId, data)
  }

  async uninstallPlugin(pluginId: string) {
    return await api.plugins.uninstallPlugin(pluginId)
  }
}

export const pluginRepository: IPluginRepository = new DefaultPluginRepository()
