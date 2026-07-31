import type { App } from 'vue'
import type { Router } from 'vue-router'
import { useGlobalSettingsStore } from '~/01.shared/store/settings.store'
import { pluginManager } from './plugin-manager'

export async function setupPlugins(app: App, router: Router) {
  const settingsStore = useGlobalSettingsStore()
  const enabledPlugins = settingsStore.enabledPlugins
  const pluginsToInstall = []

  if (enabledPlugins.includes('grammar-rules')) {
    const { default: grammarRulesPlugin } = await import('@injurka/insight-book-plugin-grammar-rules')

    pluginsToInstall.push(grammarRulesPlugin)
  }

  if (pluginsToInstall.length > 0) {
    await pluginManager.install(app, router, pluginsToInstall)
  }
}
