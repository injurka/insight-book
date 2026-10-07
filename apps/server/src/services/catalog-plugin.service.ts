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
  styleUrl?: string
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

const PLUGIN_FILE_UPLOAD_CONCURRENCY = 8

export function getPluginContentType(filename: string): string {
  return PLUGIN_CONTENT_TYPES[path.extname(filename).toLowerCase()] || 'application/octet-stream'
}

export class CatalogPluginService {
  constructor(private catalogRepo = catalogPluginRepository) {}

  async getPlugins() {
    return this.catalogRepo.findLatestApprovedVersions()
  }

  async getMyPlugins(userId: number) {
    return this.catalogRepo.findLatestVersionsByUploader(userId)
  }

  async getPendingPlugins(userId: number) {
    await this.assertAdmin(userId)
    return this.catalogRepo.findVersions(CATALOG_PLUGIN_STATUS.PENDING)
  }

  async listPlugins(userId: number, status?: CatalogPluginStatus) {
    await this.assertAdmin(userId)
    return this.catalogRepo.findVersions(status)
  }

  async setPluginStatus(userId: number, pluginId: string, version: string, status: CatalogPluginStatus) {
    await this.assertAdmin(userId)

    const updated = await this.catalogRepo.updateVersionStatus(pluginId, version, status)
    if (!updated) {
      throw new AppError(404, ERROR_CODES.PLUGIN.NOT_FOUND, 'Plugin version not found in catalog')
    }

    const currentRelease = (await this.catalogRepo.findLatestApprovedVersions())
      .find(plugin => plugin.id === pluginId)
    if (currentRelease) {
      await this.catalogRepo.upsert({
        id: currentRelease.id,
        name: currentRelease.name,
        version: currentRelease.version,
        description: currentRelease.description,
        icon: currentRelease.icon,
        author: currentRelease.author,
        sourceUrl: currentRelease.sourceUrl,
        manifestUrl: currentRelease.manifestUrl,
        uploadedBy: currentRelease.uploadedBy,
        status: CATALOG_PLUGIN_STATUS.APPROVED,
      })
    }
    else {
      await this.catalogRepo.updateStatus(pluginId, CATALOG_PLUGIN_STATUS.REJECTED)
    }

    logger.info(`[Catalog] Plugin "${pluginId}" v${version} status changed to "${status}" by user ${userId}`)
    return updated
  }

  async setLatestPluginStatus(userId: number, pluginId: string, status: CatalogPluginStatus) {
    await this.assertAdmin(userId)
    const releases = await this.catalogRepo.findVersions()
    const pluginReleases = releases.filter(release => release.id === pluginId)
    const target = pluginReleases.find(release => release.status === CATALOG_PLUGIN_STATUS.PENDING)
      ?? pluginReleases[0]

    if (!target) {
      throw new AppError(404, ERROR_CODES.PLUGIN.NOT_FOUND, 'Plugin not found in catalog')
    }

    return this.setPluginStatus(userId, pluginId, target.version, status)
  }

  async getPlugin(pluginId: string) {
    const plugin = (await this.catalogRepo.findLatestApprovedVersions())
      .find(record => record.id === pluginId)
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
  async uploadPlugin(userId: number, file: File, pluginId?: string) {
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

    if (pluginId !== undefined && manifest.id !== pluginId) {
      throw new AppError(400, ERROR_CODES.PLUGIN.INVALID_MANIFEST, 'Archive plugin ID does not match the plugin being updated')
    }

    if (manifest.source !== undefined) {
      if (typeof manifest.source !== 'string' || !/^https?:\/\//i.test(manifest.source)) {
        throw new AppError(400, ERROR_CODES.PLUGIN.INVALID_MANIFEST, 'manifest.json: field source must be an http(s) URL')
      }
    }

    // Проверяем авторство, если плагин с таким ID уже существует
    const existingPlugin = await this.catalogRepo.findOne(manifest.id)
    if (existingPlugin) {
      const user = await userRepository.findById(userId)
      const isAdmin = user?.role === ROLES.ADMIN
      if (!isAdmin && existingPlugin.uploadedBy !== userId) {
        throw new AppError(403, ERROR_CODES.AUTH.FORBIDDEN, 'Plugin ID already taken by another author')
      }
    }

    const existingVersion = await this.catalogRepo.findVersion(manifest.id, manifest.version)
    if (existingVersion?.status === CATALOG_PLUGIN_STATUS.APPROVED) {
      throw new AppError(409, ERROR_CODES.PLUGIN.INVALID_MANIFEST, `Version ${manifest.version} is already published and cannot be replaced`)
    }

    // Префикс папки внутри архива, в которой лежит manifest.json
    const basePrefix = path.posix.dirname(manifestEntry.entryName)
    const storagePrefix = `plugins/${manifest.id}/${manifest.version}`

    // Удаляем старую версию этой же версии (перезапись), остальные версии сохраняем
    await storageService.deleteFolder(storagePrefix)

    const filesToUpload = entries.flatMap((entry) => {
      if (basePrefix !== '.' && !entry.entryName.startsWith(`${basePrefix}/`)) {
        return []
      }

      const relativePath = basePrefix === '.'
        ? entry.entryName
        : entry.entryName.slice(basePrefix.length + 1)

      if (!relativePath || relativePath.includes('..'))
        return []

      const key = `${storagePrefix}/${relativePath}`
      return [{ entry, key, contentType: getPluginContentType(relativePath) }]
    })

    logger.info(`[Catalog] Storing plugin "${manifest.id}" v${manifest.version}: ${filesToUpload.length} files from ${file.size} bytes`)

    let nextIndex = 0
    let uploadError: unknown
    let hasUploadError = false
    const uploadWorker = async () => {
      while (!hasUploadError) {
        const item = filesToUpload[nextIndex++]
        if (!item)
          return

        try {
          await storageService.uploadFile(item.key, item.entry.getData(), item.contentType)
        }
        catch (error) {
          if (!hasUploadError) {
            uploadError = error
            hasUploadError = true
          }
        }
      }
    }

    const workerCount = Math.min(PLUGIN_FILE_UPLOAD_CONCURRENCY, filesToUpload.length)
    await Promise.all(Array.from({ length: workerCount }, () => uploadWorker()))
    if (hasUploadError)
      throw uploadError

    // Сохраняем оригинальный zip-архив для скачивания модератором/автором
    const archiveKey = `${storagePrefix}.zip`
    logger.info(`[Catalog] Plugin "${manifest.id}" v${manifest.version}: assets stored; saving original archive`)
    await storageService.deleteFile(archiveKey).catch(() => {})
    await storageService.uploadFile(archiveKey, Buffer.from(await file.arrayBuffer()), 'application/zip')

    const manifestUrl = `/api/catalog/plugins/files/${manifest.id}/${manifest.version}/manifest.json`

    logger.info(`[Catalog] Plugin "${manifest.id}" v${manifest.version}: archive stored; saving release record`)
    const versionRecord = {
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
    }

    if (!existingPlugin) {
      await this.catalogRepo.upsert(versionRecord)
    }

    const plugin = await this.catalogRepo.saveVersion({
      pluginId: manifest.id,
      version: manifest.version,
      name: manifest.name,
      description: manifest.description ?? null,
      icon: manifest.icon ?? null,
      author: manifest.author ?? null,
      sourceUrl: manifest.source ?? null,
      manifestUrl,
      uploadedBy: userId,
      status: CATALOG_PLUGIN_STATUS.PENDING,
    })

    logger.info(`[Catalog] Plugin "${manifest.id}" v${manifest.version} uploaded by user ${userId} (${filesToUpload.length} files)`)

    return plugin ?? versionRecord
  }

  /**
   * Скачивание оригинального zip-архива плагина (для модерации).
   * Доступно админу; автор плагина также может скачать свой архив.
   */
  async downloadPlugin(userId: number, pluginId: string, version?: string) {
    let plugin = version ? await this.catalogRepo.findVersion(pluginId, version) : null
    if (!version) {
      const releases = await this.catalogRepo.findVersions()
        .then(records => records.filter(record => record.id === pluginId))
      plugin = releases.find(release => release.status === CATALOG_PLUGIN_STATUS.PENDING)
        ?? releases[0]
        ?? null
    }
    if (!plugin) {
      throw new AppError(404, ERROR_CODES.PLUGIN.NOT_FOUND, 'Plugin version not found in catalog')
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

  async deletePluginVersion(userId: number, pluginId: string, version: string) {
    const release = await this.catalogRepo.findVersion(pluginId, version)
    if (!release) {
      throw new AppError(404, ERROR_CODES.PLUGIN.NOT_FOUND, 'Plugin version not found in catalog')
    }

    const user = await userRepository.findById(userId)
    const isAdmin = user?.role === ROLES.ADMIN
    if (!isAdmin && release.uploadedBy !== userId) {
      throw new AppError(403, ERROR_CODES.AUTH.FORBIDDEN, 'Only admin or plugin uploader can delete this release')
    }
    if (release.status === CATALOG_PLUGIN_STATUS.APPROVED) {
      throw new AppError(409, ERROR_CODES.PLUGIN.INVALID_MANIFEST, 'Published releases cannot be deleted individually')
    }

    await this.catalogRepo.deleteVersion(pluginId, version)
    await storageService.deleteFolder(`plugins/${pluginId}/${version}`)
    await storageService.deleteFile(`plugins/${pluginId}/${version}.zip`).catch(() => {})

    const remainingReleases = await this.catalogRepo.findVersions()
    if (!remainingReleases.some(item => item.id === pluginId))
      await this.catalogRepo.delete(pluginId)

    return { success: true }
  }

  /** Отдача файла плагина (manifest.json, remoteEntry.js, ассеты) */
  async getPluginFile(storageKey: string) {
    if (storageKey.includes('..')) {
      throw new AppError(400, ERROR_CODES.SYSTEM.VALIDATION_ERROR, 'Invalid path')
    }

    const pathParts = storageKey.split('/')
    const pluginId = pathParts[1]
    const version = pathParts[2]
    if (pathParts[0] !== 'plugins' || pathParts.length < 4 || !pluginId || !version) {
      throw new AppError(400, ERROR_CODES.SYSTEM.VALIDATION_ERROR, 'Invalid plugin path')
    }

    const release = await this.catalogRepo.findVersion(pluginId, version)
    if (!release || release.status !== CATALOG_PLUGIN_STATUS.APPROVED) {
      return null
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
