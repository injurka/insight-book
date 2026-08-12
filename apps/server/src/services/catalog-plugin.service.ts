import type { CatalogPluginStatus } from '../constants/catalog-plugin'
import path from 'node:path'
import AdmZip from 'adm-zip'
import { CATALOG_PLUGIN_STATUS } from '../constants/catalog-plugin'
import { ERROR_CODES } from '../constants/error-codes'
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
  /** Ссылка на исходный код плагина (репозиторий), используется при модерации */
  source?: string
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
    return this.catalogRepo.findMany(CATALOG_PLUGIN_STATUS.APPROVED)
  }

  async getMyPlugins(userId: number) {
    return this.catalogRepo.findByUploader(userId)
  }

  async getPendingPlugins(userId: number) {
    await this.assertAdmin(userId)
    return this.catalogRepo.findMany(CATALOG_PLUGIN_STATUS.PENDING)
  }

  async setPluginStatus(userId: number, pluginId: string, status: CatalogPluginStatus) {
    await this.assertAdmin(userId)

    const updated = await this.catalogRepo.updateStatus(pluginId, status)
    if (!updated) {
      throw new AppError(404, ERROR_CODES.PLUGIN.NOT_FOUND, 'Plugin not found in catalog')
    }

    logger.info(`[Catalog] Plugin "${pluginId}" status changed to "${status}" by user ${userId}`)
    return updated
  }

  async getPlugin(pluginId: string) {
    const plugin = await this.catalogRepo.findOne(pluginId)
    if (!plugin) {
      throw new AppError(404, ERROR_CODES.PLUGIN.NOT_FOUND, 'Plugin not found in catalog')
    }
    return plugin
  }

  /**
   * Загрузка плагина в каталог из zip-архива со сборкой Module Federation
   * (manifest.json + remoteEntry.js + ассеты). Доступна любому авторизованному
   * пользователю; плагин попадает в каталог со статусом "pending" и публикуется
   * после модерации.
   */
  async uploadPlugin(userId: number, file: File) {
    if (!file.name.toLowerCase().endsWith('.zip')) {
      throw new AppError(400, ERROR_CODES.PLUGIN.INVALID_MANIFEST, 'Zip archive with plugin build expected')
    }

    let zip: AdmZip
    try {
      zip = new AdmZip(Buffer.from(await file.arrayBuffer()))
    }
    catch {
      throw new AppError(400, ERROR_CODES.PLUGIN.INVALID_MANIFEST, 'Failed to read zip archive')
    }

    const entries = zip.getEntries().filter(e => !e.isDirectory)

    // Ищем manifest.json (может лежать в корне архива или во вложенной папке dist/)
    const manifestEntry = entries
      .filter(e => path.posix.basename(e.entryName) === 'manifest.json')
      .sort((a, b) => a.entryName.length - b.entryName.length)[0]

    if (!manifestEntry) {
      throw new AppError(400, ERROR_CODES.PLUGIN.INVALID_MANIFEST, 'manifest.json not found in archive')
    }

    let manifest: PluginManifest
    try {
      manifest = JSON.parse(manifestEntry.getData().toString('utf-8'))
    }
    catch {
      throw new AppError(400, ERROR_CODES.PLUGIN.INVALID_MANIFEST, 'manifest.json contains invalid JSON')
    }

    if (!manifest.id || !manifest.name || !manifest.version || !manifest.entryUrl) {
      throw new AppError(400, ERROR_CODES.PLUGIN.INVALID_MANIFEST, 'manifest.json: fields id, name, version, entryUrl are required')
    }

    if (!/^[a-z0-9][\w-]*$/i.test(manifest.id)) {
      throw new AppError(400, ERROR_CODES.PLUGIN.INVALID_MANIFEST, 'manifest.json: invalid plugin id')
    }

    if (manifest.source !== undefined) {
      if (typeof manifest.source !== 'string' || !/^https?:\/\//i.test(manifest.source)) {
        throw new AppError(400, ERROR_CODES.PLUGIN.INVALID_MANIFEST, 'manifest.json: field source must be an http(s) URL')
      }
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

    // Сохраняем оригинальный zip-архив для скачивания модератором/автором
    const archiveKey = `${storagePrefix}.zip`
    await storageService.deleteFile(archiveKey).catch(() => {})
    await storageService.uploadFile(archiveKey, Buffer.from(await file.arrayBuffer()), 'application/zip')

    const manifestUrl = `/api/catalog/plugins/files/${manifest.id}/${manifest.version}/manifest.json`

    const plugin = await this.catalogRepo.upsert({
      id: manifest.id,
      name: manifest.name,
      version: manifest.version,
      description: manifest.description ?? null,
      icon: manifest.icon ?? null,
      author: manifest.author ?? null,
      sourceUrl: manifest.source ?? null,
      manifestUrl,
      uploadedBy: userId,
      status: CATALOG_PLUGIN_STATUS.PENDING,
    })

    logger.info(`[Catalog] Plugin "${manifest.id}" v${manifest.version} uploaded by user ${userId} (${uploadedCount} files)`)

    return plugin
  }

  /**
   * Скачивание оригинального zip-архива плагина (для модерации).
   * Доступно админу; автор плагина также может скачать свой архив.
   */
  async downloadPlugin(userId: number, pluginId: string) {
    const plugin = await this.catalogRepo.findOne(pluginId)
    if (!plugin) {
      throw new AppError(404, ERROR_CODES.PLUGIN.NOT_FOUND, 'Plugin not found in catalog')
    }

    const user = await userRepository.findById(userId)
    const isAdmin = user?.role === ROLES.ADMIN
    if (!isAdmin && plugin.uploadedBy !== userId) {
      throw new AppError(403, ERROR_CODES.AUTH.FORBIDDEN, 'Only admin or plugin uploader can download plugin archive')
    }

    const archiveKey = `plugins/${plugin.id}/${plugin.version}.zip`
    const fileData = await storageService.getFile(archiveKey)
    if (!fileData) {
      throw new AppError(404, ERROR_CODES.PLUGIN.NOT_FOUND, 'Plugin archive not found in storage')
    }

    return { buffer: fileData.buffer, filename: `${plugin.id}-v${plugin.version}.zip` }
  }

  async deletePlugin(userId: number, pluginId: string) {
    const plugin = await this.catalogRepo.findOne(pluginId)
    if (!plugin) {
      throw new AppError(404, ERROR_CODES.PLUGIN.NOT_FOUND, 'Plugin not found in catalog')
    }

    const user = await userRepository.findById(userId)
    if (user?.role !== ROLES.ADMIN && plugin.uploadedBy !== userId) {
      throw new AppError(403, ERROR_CODES.AUTH.FORBIDDEN, 'Only admin or plugin uploader can delete plugin')
    }

    await this.catalogRepo.delete(pluginId)

    await storageService.deleteFolder(`plugins/${pluginId}`)
    return { success: true }
  }

  /** Отдача файла плагина (manifest.json, remoteEntry.js, ассеты) */
  async getPluginFile(storageKey: string) {
    if (storageKey.includes('..')) {
      throw new AppError(400, ERROR_CODES.SYSTEM.VALIDATION_ERROR, 'Invalid path')
    }
    return storageService.getFile(storageKey)
  }

  private async assertAdmin(userId: number) {
    const user = await userRepository.findById(userId)
    if (user?.role !== ROLES.ADMIN) {
      throw new AppError(403, ERROR_CODES.AUTH.FORBIDDEN, 'Only admin can manage plugin catalog')
    }
  }
}

export const catalogPluginService = new CatalogPluginService()
