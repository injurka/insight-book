import type {
  InsightBookPlugin,
  InsightBookPluginContext,
  InsightBookPluginEventBus,
} from '@injurka/insight-book-plugin-api'
import type { App } from 'vue'
import type { Router } from 'vue-router'
import { reactive } from 'vue'
import { i18n } from '~/shared/plugins/i18n'

export interface PluginNavItem {
  title: string
  titleKey?: string
  icon?: string
  routeName: string
}

class SimpleEventBus implements InsightBookPluginEventBus {
  private listeners = new Map<string, Set<(data: any) => void>>()

  on(event: string, callback: (data: any) => void) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event)!.add(callback)
  }

  off(event: string, callback: (data: any) => void) {
    const set = this.listeners.get(event)
    if (set) {
      set.delete(callback)
      if (set.size === 0) {
        this.listeners.delete(event)
      }
    }
  }

  emit(event: string, data?: any) {
    const set = this.listeners.get(event)
    if (set) {
      set.forEach((cb) => {
        try {
          cb(data)
        }
        catch (err) {
          console.error(`[Event Bus] Error in listener for event "${event}":`, err)
        }
      })
    }
  }

  clear() {
    this.listeners.clear()
  }
}

const globalEventBus = new SimpleEventBus()

export function usePluginManager() {
  const plugins = reactive<InsightBookPlugin[]>([])
  const navItems = reactive<PluginNavItem[]>([])

  const install = async (_app: App, router: Router, pluginInstances: InsightBookPlugin[]) => {
    const notify = (message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') => {
      console.warn(`[Plugin Notify] ${type}: ${message}`)
      // In a real app, integrate with ToastManager
      // e.g. useToast().success(message)
    }

    const addNavigationItem = (item: PluginNavItem) => {
      navItems.push(item)
    }

    for (const plugin of pluginInstances) {
      if (plugins.some(p => p.id === plugin.id)) {
        console.warn(`[Plugin Manager] Plugin with ID "${plugin.id}" is already installed.`)
        continue
      }

      console.warn(`[Plugin Manager] Activating plugin "${plugin.id}" (v${plugin.version})...`)

      const ctx: InsightBookPluginContext = {
        notify,
        addNavigationItem,
        events: globalEventBus,
        locale: i18n.global.locale.value,
        registerTranslations: (messages) => {
          for (const [lang, msgs] of Object.entries(messages)) {
            i18n.global.mergeLocaleMessage(lang, {
              plugins: {
                [plugin.id]: msgs,
              },
            })
          }
        },
      }

      // Add pages to router
      if (plugin.pages) {
        for (const [pathKey, component] of Object.entries(plugin.pages)) {
          const routePath = pathKey === 'index' ? `/plugin/${plugin.id}` : `/plugin/${plugin.id}/${pathKey}`
          const routeName = pathKey === 'index' ? `plugin-${plugin.id}-index` : `plugin-${plugin.id}-${pathKey}`

          router.addRoute({
            path: routePath,
            name: routeName,
            component: component as any,
          })
        }
      }

      // Activate plugin safely
      try {
        if (plugin.activate) {
          await plugin.activate(ctx)
        }
        plugins.push(plugin)
      }
      catch (err) {
        console.error(`[Plugin Manager] Failed to activate plugin "${plugin.id}":`, err)

        // Rollback router changes if activation fails
        if (plugin.pages) {
          for (const pathKey of Object.keys(plugin.pages)) {
            const routeName = pathKey === 'index' ? `plugin-${plugin.id}-index` : `plugin-${plugin.id}-${pathKey}`
            if (router.hasRoute(routeName)) {
              router.removeRoute(routeName)
            }
          }
        }
      }
    }
  }

  const uninstall = async (pluginId: string, router: Router) => {
    const index = plugins.findIndex(p => p.id === pluginId)
    if (index === -1) {
      console.warn(`[Plugin Manager] Plugin "${pluginId}" is not installed.`)
      return
    }

    const plugin = plugins[index]
    console.warn(`[Plugin Manager] Deactivating plugin "${plugin.id}"...`)

    try {
      if (plugin.deactivate) {
        const ctx: InsightBookPluginContext = {
          notify: (message, type) => console.warn(`[Plugin Notify] ${type}: ${message}`),
          addNavigationItem: () => { },
          events: globalEventBus,
          locale: i18n.global.locale.value,
          registerTranslations: () => { },
        }
        await plugin.deactivate(ctx)
      }
    }
    catch (err) {
      console.error(`[Plugin Manager] Error during deactivation of plugin "${pluginId}":`, err)
    }

    // Remove pages from router
    if (plugin.pages) {
      for (const pathKey of Object.keys(plugin.pages)) {
        const routeName = pathKey === 'index' ? `plugin-${plugin.id}-index` : `plugin-${plugin.id}-${pathKey}`
        if (router.hasRoute(routeName)) {
          router.removeRoute(routeName)
        }
      }
    }

    // Remove navigation items
    const routePrefix = `plugin-${plugin.id}-`
    for (let i = navItems.length - 1; i >= 0; i--) {
      if (navItems[i].routeName.startsWith(routePrefix)) {
        navItems.splice(i, 1)
      }
    }

    plugins.splice(index, 1)
    console.warn(`[Plugin Manager] Plugin "${pluginId}" uninstalled.`)
  }

  return {
    install,
    uninstall,
    plugins,
    navItems,
    events: globalEventBus,
  }
}

export const pluginManager = usePluginManager()
