import path from 'node:path'
import AdmZip from 'adm-zip'
import { ROLES } from '../constants/roles'
import { catalogPluginRepository } from '../repositories/catalog-plugin.repository'
import { userRepository } from '../repositories/user.repository'
import { AppError } from '../utils/errors'
import { logger } from '../utils/logger'
import { storageService } from './storage.service'

export interface PluginManifest {
  id: string
  name: string
  version: string
  description?: string
  icon?: string
  author?: string
  entryUrl: string
}

const PLUGIN_CONTENT_TYPES: Record<string, string> = {
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
}

export function getPluginContentType(filename: string): string {
  return PLUGIN_CONTENT_TYPES[path.extname(filename).toLowerCase()] || 'application/octet-stream'
}

export class CatalogPluginService {
  constructor(private catalogRepo = catalogPluginRepository) {}

  async getPlugins() {
    return this.catalogRepo.findMany()
  }

  async getPlugin(pluginId: string) {
    const plugin = await this.catalogRepo.findOne(pluginId)
    if (!plugin) {
      throw new AppError(404, 'Плагин не найден в каталоге')
    }
    return plugin
  }

  /**
   * Загрузка плагина в каталог из zip-архива со сборкой Module Federation
   * (manifest.json + remoteEntry.js + ассеты). Только для администраторов.
   */
  async uploadPlugin(userId: number, file: File) {
    await this.assertAdmin(userId)

    if (!file.name.toLowerCase().endsWith('.zip')) {
      throw new AppError(400, 'Ожидается zip-архив со сборкой плагина')
    }

    let zip: AdmZip
    try {
      zip = new AdmZip(Buffer.from(await file.arrayBuffer()))
    }
    catch {
      throw new AppError(400, 'Не удалось прочитать zip-архив')
    }

    const entries = zip.getEntries().filter(e => !e.isDirectory)

    // Ищем manifest.json (может лежать в корне архива или во вложенной папке dist/)
    const manifestEntry = entries
      .filter(e => path.posix.basename(e.entryName) === 'manifest.json')
      .sort((a, b) => a.entryName.length - b.entryName.length)[0]

    if (!manifestEntry) {
      throw new AppError(400, 'В архиве не найден manifest.json')
    }

    let manifest: PluginManifest
    try {
      manifest = JSON.parse(manifestEntry.getData().toString('utf-8'))
    }
    catch {
      throw new AppError(400, 'manifest.json содержит невалидный JSON')
    }

    if (!manifest.id || !manifest.name || !manifest.version || !manifest.entryUrl) {
      throw new AppError(400, 'manifest.json: обязательны поля id, name, version, entryUrl')
    }

    if (!/^[a-z0-9][\w-]*$/i.test(manifest.id)) {
      throw new AppError(400, 'manifest.json: недопустимый id плагина')
    }

    // Префикс папки внутри архива, в которой лежит manifest.json
    const basePrefix = path.posix.dirname(manifestEntry.entryName)
    const storagePrefix = `plugins/${manifest.id}/${manifest.version}`

    // Удаляем старую версию этой же версии (перезапись), остальные версии сохраняем
    await storageService.deleteFolder(storagePrefix)

    let uploadedCount = 0
    for (const entry of entries) {
      if (basePrefix !== '.' && !entry.entryName.startsWith(`${basePrefix}/`)) {
        continue
      }

      const relativePath = basePrefix === '.'
        ? entry.entryName
        : entry.entryName.slice(basePrefix.length + 1)

      if (!relativePath || relativePath.includes('..')) {
        continue
      }

      const key = `${storagePrefix}/${relativePath}`
      await storageService.uploadFile(key, entry.getData(), getPluginContentType(relativePath))
      uploadedCount++
    }

    const manifestUrl = `/api/catalog/plugins/files/${manifest.id}/${manifest.version}/manifest.json`

    const plugin = await this.catalogRepo.upsert({
      id: manifest.id,
      name: manifest.name,
      version: manifest.version,
      description: manifest.description ?? null,
      icon: manifest.icon ?? null,
      author: manifest.author ?? null,
      manifestUrl,
      uploadedBy: userId,
    })

    logger.info(`[Catalog] Plugin "${manifest.id}" v${manifest.version} uploaded by user ${userId} (${uploadedCount} files)`)

    return plugin
  }

  async deletePlugin(userId: number, pluginId: string) {
    await this.assertAdmin(userId)

    const deleted = await this.catalogRepo.delete(pluginId)
    if (!deleted) {
      throw new AppError(404, 'Плагин не найден в каталоге')
    }

    await storageService.deleteFolder(`plugins/${pluginId}`)
    return { success: true }
  }

  /** Отдача файла плагина (manifest.json, remoteEntry.js, ассеты) */
  async getPluginFile(storageKey: string) {
    if (storageKey.includes('..')) {
      throw new AppError(400, 'Недопустимый путь')
    }
    return storageService.getFile(storageKey)
  }

  private async assertAdmin(userId: number) {
    const user = await userRepository.findById(userId)
    if (user?.role !== ROLES.ADMIN) {
      throw new AppError(403, 'Только администратор может управлять каталогом плагинов')
    }
  }
}

export const catalogPluginService = new CatalogPluginService()
