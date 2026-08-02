import type { InsightBookPluginManifest } from '@injurka/insight-book-plugin-api'
import { dbRpc } from '~/01.shared/lib/db.client'

export interface CachedPluginRecord {
  pluginId: string
  manifestUrl: string
  manifest: InsightBookPluginManifest
  remoteEntryUrl: string
  updatedAt: number
}

function getPluginKey(pluginId: string) {
  return `plugin_cached_${pluginId}`
}

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
    await dbRpc.saveSetting(getPluginKey(pluginId), JSON.stringify(record))
  }
  catch (err) {
    console.warn('[Plugin Storage] Failed to save plugin to SQLite cache:', err)
  }
}

export async function getCachedPlugin(pluginId: string): Promise<CachedPluginRecord | null> {
  try {
    const json = await dbRpc.getSetting(getPluginKey(pluginId))
    if (!json)
      return null

    return JSON.parse(json)
  }
  catch (err) {
    console.warn('[Plugin Storage] Failed to read plugin from SQLite cache:', err)

    return null
  }
}

export async function removeCachedPlugin(pluginId: string): Promise<void> {
  try {
    await dbRpc.deleteSetting(getPluginKey(pluginId))
  }
  catch (err) {
    console.warn('[Plugin Storage] Failed to remove plugin from SQLite cache:', err)
  }
}
