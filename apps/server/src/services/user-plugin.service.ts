import type { UserPluginRepository } from '../repositories/user-plugin.repository'
import { ERROR_CODES } from '../constants/error-codes'
import { userPluginRepository } from '../repositories/user-plugin.repository'
import { AppError } from '../utils/errors'

export class UserPluginService {
  constructor(private userPluginRepo: UserPluginRepository = userPluginRepository) {}

  async getUserPlugins(userId: number) {
    return this.userPluginRepo.findMany(userId)
  }

  async installPlugin(
    userId: number,
    body: {
      pluginId: string
      manifestUrl: string
      settings?: string | null
      isEnabled?: boolean
    },
  ) {
    if (!body.pluginId || !body.manifestUrl) {
      throw new AppError(400, ERROR_CODES.PLUGIN.INVALID_MANIFEST, 'pluginId and manifestUrl are required')
    }

    return this.userPluginRepo.upsert({
      userId,
      pluginId: body.pluginId,
      manifestUrl: body.manifestUrl,
      settings: body.settings ?? null,
      isEnabled: body.isEnabled ?? true,
    })
  }

  async updatePlugin(
    userId: number,
    pluginId: string,
    body: {
      isEnabled?: boolean
      settings?: string | null
    },
  ) {
    const updated = await this.userPluginRepo.update(userId, pluginId, body)
    if (!updated) {
      throw new AppError(404, ERROR_CODES.PLUGIN.NOT_FOUND, 'Plugin not found')
    }
    return updated
  }

  async uninstallPlugin(userId: number, pluginId: string) {
    const deleted = await this.userPluginRepo.delete(userId, pluginId)
    if (!deleted) {
      throw new AppError(404, ERROR_CODES.PLUGIN.NOT_FOUND, 'Plugin not found')
    }
    return { success: true }
  }
}

export const userPluginService = new UserPluginService()
