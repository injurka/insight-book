import type { UnlistenFn } from '@tauri-apps/api/event'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { defineStore } from 'pinia'
import { isTauri } from '~/01.shared/lib/env'
import { openExternalUrl } from '~/01.shared/lib/opener'
import { useToastStore } from './toast.store'

const GITHUB_REPO = 'injurka/insight-book'
export const API_GITHUB_RELEASES_LATEST = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`
export const GITHUB_RELEASES_PAGE = `https://github.com/${GITHUB_REPO}/releases/latest`

export interface DownloadProgressPayload {
  downloaded: number
  total: number | null
  percentage: number
  done: boolean
  path?: string | null
}

export interface AppUpdateState {
  hasUpdate: boolean
  latestVersion: string | null
  apkUrl: string | null
  releaseUrl: string
  isDownloading: boolean
  downloadProgress: number
  downloadedBytes: number
  totalBytes: number | null
  downloadedFilePath: string | null
  downloadError: string | null
}

interface ReleaseAsset {
  name?: string
  browser_download_url?: string
}

interface GitHubReleaseResponse {
  tag_name?: string
  html_url?: string
  assets?: ReleaseAsset[]
}

interface ParsedUpdateInfo {
  version: string
  apkUrl: string | null
  releaseUrl: string
}

let unlistenProgress: UnlistenFn | null = null

function compareVersions(v1: string, v2: string): number {
  const parts1 = v1.replace(/^v/, '').split('.').map(Number)
  const parts2 = v2.replace(/^v/, '').split('.').map(Number)

  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const p1 = parts1[i] || 0
    const p2 = parts2[i] || 0

    if (p1 > p2)
      return 1

    if (p1 < p2)
      return -1
  }

  return 0
}

function getCurrentAppVersion(): string {
  if (typeof __APP_VERSION__ !== 'undefined')
    return __APP_VERSION__

  return '0.0.0'
}

function shouldUpdate(tag: string, currentVersion: string): boolean {
  const cleanLatest = tag.replace(/^\D*/, '')
  if (!cleanLatest)
    return false

  return compareVersions(cleanLatest, currentVersion) > 0
}

function findApkAsset(assets?: ReleaseAsset[]): ReleaseAsset | undefined {
  return assets?.find(asset =>
    typeof asset.name === 'string' && asset.name.endsWith('.apk'))
}

function parseUpdateInfo(release: GitHubReleaseResponse): ParsedUpdateInfo | null {
  const tag = release.tag_name || ''
  if (!shouldUpdate(tag, getCurrentAppVersion()))
    return null

  const apkAsset = findApkAsset(release.assets)

  return {
    version: tag.replace(/^\D*/, ''),
    apkUrl: apkAsset?.browser_download_url ?? null,
    releaseUrl: release.html_url || GITHUB_RELEASES_PAGE,
  }
}

async function fetchLatestRelease(): Promise<GitHubReleaseResponse | null> {
  const response = await fetch(API_GITHUB_RELEASES_LATEST)
  if (!response.ok)
    return null

  return (await response.json()) as GitHubReleaseResponse
}

export const useAppUpdateStore = defineStore('appUpdate', {
  state: (): AppUpdateState => ({
    hasUpdate: false,
    latestVersion: null,
    apkUrl: null,
    releaseUrl: GITHUB_RELEASES_PAGE,
    isDownloading: false,
    downloadProgress: 0,
    downloadedBytes: 0,
    totalBytes: null,
    downloadedFilePath: null,
    downloadError: null,
  }),

  actions: {
    async checkForUpdates(silent = true): Promise<boolean> {
      if (silent && !isTauri)
        return false

      try {
        const latestRelease = await fetchLatestRelease()
        const updateInfo = latestRelease ? parseUpdateInfo(latestRelease) : null
        if (!updateInfo)
          return false

        this.hasUpdate = true
        this.latestVersion = updateInfo.version
        this.apkUrl = updateInfo.apkUrl
        this.releaseUrl = updateInfo.releaseUrl

        return true
      }
      catch (e) {
        if (!silent)
          throw e
        console.error('[AppUpdate] Ошибка при проверке обновлений:', e)

        return false
      }
    },

    async startUpdate() {
      if (isTauri && this.apkUrl) {
        await this.downloadUpdateInApp()

        return
      }

      const url = this.apkUrl || this.releaseUrl
      if (!url) {
        this.closePrompt()

        return
      }

      const toastStore = useToastStore()
      toastStore.info('Переход к загрузке обновления...')
      await openExternalUrl(url)
    },

    async downloadUpdateInApp() {
      if (!this.apkUrl)
        return

      const toastStore = useToastStore()
      this.isDownloading = true
      this.downloadProgress = 0
      this.downloadedBytes = 0
      this.totalBytes = null
      this.downloadError = null
      this.downloadedFilePath = null

      try {
        if (unlistenProgress) {
          unlistenProgress()
          unlistenProgress = null
        }

        unlistenProgress = await listen<DownloadProgressPayload>('app-update://progress', (event) => {
          const payload = event.payload
          this.downloadedBytes = payload.downloaded
          this.totalBytes = payload.total
          this.downloadProgress = Math.round(payload.percentage)

          if (payload.done && payload.path) {
            this.downloadedFilePath = payload.path
            this.downloadProgress = 100
          }
        })

        const filename = `insight-book-v${this.latestVersion || 'latest'}.apk`
        const filePath = await invoke<string>('download_app_update', {
          url: this.apkUrl,
          filename,
        })

        this.downloadedFilePath = filePath
        this.downloadProgress = 100
        this.isDownloading = false

        toastStore.success('Обновление успешно загружено!')
        await this.installApk()
      }
      catch (err: unknown) {
        console.error('[AppUpdate] Ошибка при загрузке обновления:', err)
        this.isDownloading = false
        this.downloadError = typeof err === 'string' ? err : ((err as Error)?.message || 'Не удалось загрузить обновление')
        toastStore.error(`Ошибка загрузки: ${this.downloadError}`)
      }
      finally {
        if (unlistenProgress) {
          unlistenProgress()
          unlistenProgress = null
        }
      }
    },

    async installApk() {
      if (!this.downloadedFilePath)
        return

      const toastStore = useToastStore()
      try {
        await invoke('open_downloaded_apk', { path: this.downloadedFilePath })
      }
      catch (e: unknown) {
        console.error('[AppUpdate] Ошибка открытия локального установщика APK:', e)
        toastStore.error('APK загружен, но Android не смог открыть установщик. Нажмите «Установить», чтобы повторить.')
      }
    },

    async openExternalRelease() {
      const url = this.apkUrl || this.releaseUrl
      if (url)
        await openExternalUrl(url)
    },

    closePrompt() {
      this.hasUpdate = false
    },
  },
})
