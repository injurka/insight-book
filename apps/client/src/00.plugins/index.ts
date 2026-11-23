import type { App } from 'vue'
import type { Router } from 'vue-router'
import { watch } from 'vue'
import { useGlobalSettingsStore } from '~/01.shared/store/settings.store'
import { builtInPlugins, isBuiltInPluginEnabled } from './built-in-plugins'
import { pluginManager } from './plugin-manager'

let setupPluginsPromise: Promise<void> | null = null

export function setupPlugins(app: App | null, router: Router): Promise<void> {
  if (setupPluginsPromise)
    return setupPluginsPromise

  const settings = useGlobalSettingsStore()
  const isEnabled = (plugin: typeof builtInPlugins[number]) => isBuiltInPluginEnabled(plugin, settings)

  async function syncPlugins() {
    for (const plugin of builtInPlugins) {
      const installed = pluginManager.plugins.some(item => item.id === plugin.id)

      try {
        if (isEnabled(plugin) && !installed) {
          const { default: instance } = await plugin.load()

          if (isEnabled(plugin))
            await pluginManager.install(app, router, [instance])
        }
        else if (!isEnabled(plugin) && installed) {
          await pluginManager.uninstall(plugin.id, router)
        }
      }
      catch (error) {
        console.error(`[Plugin Manager] Failed to update built-in plugin "${plugin.id}":`, error)
      }
    }
  }

  // Finish the previous activation or deactivation before applying newer settings.
  let pending = setupPluginsPromise = syncPlugins()
  watch(() => builtInPlugins.map(isEnabled).join(','), () => {
    pending = pending.then(syncPlugins)
  })

  return setupPluginsPromise
}
