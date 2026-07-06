import type { Pinia } from 'pinia'
/* eslint-disable no-console */
import { getVersion } from '@tauri-apps/api/app'
import { isTauri } from '@tauri-apps/api/core'
import { openUrl } from '@tauri-apps/plugin-opener'
import { usePwaStore } from '~/shared/store/pwa.store'
import { useToastStore } from '~/shared/store/toast.store'
import { i18n } from '~/shared/plugins/i18n'

const GITHUB_REPO = 'injurka/insight-book'

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

export async function initializeTauriUpdater(pinia: Pinia): Promise<void> {
  if (!isTauri())
    return

  const pwaStore = usePwaStore(pinia)

  try {
    const currentVersion = await getVersion()

    const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`)
    if (!res.ok)
      return

    const release = await res.json()
    const latestVersion = release.tag_name

    const lastPromptStr = localStorage.getItem('insight_last_update_prompt')
    const lastPrompt = lastPromptStr ? parseInt(lastPromptStr, 10) : 0
    const ONE_DAY = 24 * 60 * 60 * 1000

    if (compareVersions(latestVersion, currentVersion) > 0 && Date.now() - lastPrompt > ONE_DAY) {
      console.log(`Update available: ${latestVersion} (current: ${currentVersion})`)

      pwaStore.setNeedRefresh(true)
      pwaStore.setUpdateFunction(async () => {
        const apkAsset = release.assets?.find((a: { name: string }) => a.name.endsWith('.apk'))
        const urlToOpen = apkAsset ? apkAsset.browser_download_url : release.html_url

        await openUrl(urlToOpen)

        const toastStore = useToastStore(pinia)
        toastStore.success(i18n.global.t('pwa.tauriUpdateToast'), { expire: 8000 })

        pwaStore.closePrompt()
      })
    }
  }
  catch (error) {
    console.error('Failed to check for Tauri updates:', error)
  }
}
