import type { InsightBookPluginManifest } from '@injurka/insight-book-plugin-api'
import localForage from 'localforage'

export interface CachedPluginRecord {
  pluginId: string
  manifestUrl: string
  manifest: InsightBookPluginManifest
  remoteEntryUrl: string
  updatedAt: number
}

const pluginStore = localForage.createInstance({
  name: 'insight_book_plugins',
  storeName: 'cached_plugins',
})

export async function saveCachedPlugin(
  pluginId: string,
  manifestUrl: string,
  manifest: InsightBookPluginManifest,
  remoteEntryUrl: string,
): Promise<void> {
  try {
    const record: CachedPluginRecord = {
      pluginId,
      manifestUrl,
      manifest,
      remoteEntryUrl,
      updatedAt: Date.now(),
    }
    await pluginStore.setItem<CachedPluginRecord>(pluginId, record)
  }
  catch (err) {
    console.warn('[Plugin Storage] Failed to save plugin to localforage cache:', err)
  }
}

export async function getCachedPlugin(pluginId: string): Promise<CachedPluginRecord | null> {
  try {
    return await pluginStore.getItem<CachedPluginRecord>(pluginId)
  }
  catch (err) {
    console.warn('[Plugin Storage] Failed to read plugin from localforage cache:', err)
    return null
  }
}

export async function removeCachedPlugin(pluginId: string): Promise<void> {
  try {
    await pluginStore.removeItem(pluginId)
  }
  catch (err) {
    console.warn('[Plugin Storage] Failed to remove plugin from localforage cache:', err)
  }
}
