import type {
  InsightBookPlugin,
  InsightBookPluginApiFacade,
  InsightBookPluginContext,
  InsightBookPluginEventBus,
  InsightBookPluginManifest,
  PluginUIWidget,
  UIPosition,
} from '@injurka/insight-book-plugin-api'
import type { App, Component } from 'vue'
import type { RouteComponent, Router } from 'vue-router'
import { init, loadRemote, registerRemotes } from '@module-federation/enhanced/runtime'
import { markRaw, reactive } from 'vue'
import { defaultRepositories } from '~/00.plugins/di'
import { i18n } from '~/00.plugins/i18n'

import { getCachedPlugin, saveCachedPlugin } from './plugin-storage'

export interface PluginNavItem {
  title: string
  titleKey?: string
  icon?: string
  routeName: string
}

export interface ManagedUIWidget extends PluginUIWidget {
  pluginId: string
  component: Component
}

export interface PluginManager {
  install: (app: App | null, router: Router, pluginInstances: InsightBookPlugin[]) => Promise<void>
  uninstall: (pluginId: string, router: Router) => Promise<void>
  loadRemotePlugin: (manifestUrl: string, router: Router) => Promise<InsightBookPlugin | null>
  getWidgets: (position: UIPosition) => ManagedUIWidget[]
  registerUIWidget: (pluginId: string, position: UIPosition, id: string, component: any, props?: Record<string, unknown>) => void
  unregisterUIWidget: (id: string) => void
  plugins: InsightBookPlugin[]
  navItems: PluginNavItem[]
  uiWidgets: ManagedUIWidget[]
  events: InsightBookPluginEventBus
}

class SimpleEventBus implements InsightBookPluginEventBus {
  private listeners = new Map<string, Set<(data: unknown) => void>>()

  on(event: string, callback: (data: unknown) => void) {
    if (!this.listeners.has(event))
      this.listeners.set(event, new Set())

    this.listeners.get(event)!.add(callback)
  }

  off(event: string, callback: (data: unknown) => void) {
    const set = this.listeners.get(event)
    if (set) {
      set.delete(callback)
      if (set.size === 0)
        this.listeners.delete(event)
    }
  }

  emit(event: string, data?: unknown) {
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

let mfRuntimeInitialized = false

function ensureMfRuntime() {
  if (mfRuntimeInitialized)
    return

  init({
    name: 'insight_book_host',
    remotes: [],
  })
  mfRuntimeInitialized = true
}

/** Преобразует id плагина в допустимое имя Module Federation remote */
function toMfRemoteName(pluginId: string) {
  return `plugin_${pluginId.replace(/\W/g, '_')}`
}

export function usePluginManager(): PluginManager {
  const plugins = reactive<InsightBookPlugin[]>([])
  const navItems = reactive<PluginNavItem[]>([])
  const navItemsByPlugin = new Map<string, PluginNavItem[]>()
  const uiWidgets = reactive<ManagedUIWidget[]>([])

  const createApiFacade = (): InsightBookPluginApiFacade => ({
    dictionary: {
      getWords: async () => {
        try {
          const { useDictionaryStore } = await import('~/05.modules/dictionary/store/dictionary.store')
          const store = useDictionaryStore()

          return store.words
        }
        catch {
          return []
        }
      },
      updateWordStats: async (id: number, score: number) => {
        await defaultRepositories.dictionary.submitReview(id, score)
      },
      submitGrade: async (wordId: number, grade: number) => {
        await defaultRepositories.dictionary.submitReview(wordId, grade)
      },
    },
    reader: {
      getCurrentBook: async () => {
        try {
          const { useReaderStore } = await import('~/05.modules/reader/store/reader.store')

          return useReaderStore().currentBook
        }
        catch {
          return null
        }
      },
    },
    user: {
      getProfile: async () => {
        try {
          const { useAuthStore } = await import('~/01.shared/store/auth.store')

          return useAuthStore().user
        }
        catch {
          return null
        }
      },
    },
  })

  const registerUIWidget = (
    pluginId: string,
    position: UIPosition,
    id: string,
    component: any,
    props?: Record<string, unknown>,
  ) => {
    const existingIndex = uiWidgets.findIndex(widget => widget.id === id)
    const widget: ManagedUIWidget = {
      id,
      position,
      component: markRaw(component),
      props,
      pluginId,
    }
    if (existingIndex !== -1)
      uiWidgets[existingIndex] = widget

    else
      uiWidgets.push(widget)
  }

  const unregisterUIWidget = (id: string) => {
    const index = uiWidgets.findIndex(widget => widget.id === id)
    if (index !== -1)
      uiWidgets.splice(index, 1)
  }

  const getWidgets = (position: UIPosition) => {
    return uiWidgets.filter(widget => widget.position === position)
  }

  const addPluginRoutes = (plugin: InsightBookPlugin, router: Router) => {
    if (plugin.pages) {
      for (const [pathKey, component] of Object.entries(plugin.pages)) {
        const routePath = pathKey === 'index' ? `/plugin/${plugin.id}` : `/plugin/${plugin.id}/${pathKey}`
        const routeName = pathKey === 'index' ? `plugin-${plugin.id}-index` : `plugin-${plugin.id}-${pathKey}`

        router.addRoute({
          path: routePath,
          name: routeName,
          component: component as RouteComponent,
        })
      }
    }
  }

  const removePluginRoutes = (plugin: InsightBookPlugin, router: Router) => {
    if (plugin.pages) {
      for (const pathKey of Object.keys(plugin.pages)) {
        const routeName = pathKey === 'index' ? `plugin-${plugin.id}-index` : `plugin-${plugin.id}-${pathKey}`
        if (router.hasRoute(routeName))
          router.removeRoute(routeName)
      }
    }
  }

  const install = async (_app: App | null, router: Router, pluginInstances: InsightBookPlugin[]) => {
    const notify = (message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') => {
      console.warn(`[Plugin Notify] ${type}: ${message}`)
    }

    for (const plugin of pluginInstances) {
      if (plugins.some(item => item.id === plugin.id)) {
        console.warn(`[Plugin Manager] Plugin with ID "${plugin.id}" is already installed.`)
        continue
      }

      console.warn(`[Plugin Manager] Activating plugin "${plugin.id}" (v${plugin.version})...`)

      const ctx: InsightBookPluginContext = {
        notify,
        addNavigationItem: (item: PluginNavItem) => {
          navItems.push(item)
          const items = navItemsByPlugin.get(plugin.id) ?? []
          items.push(item)
          navItemsByPlugin.set(plugin.id, items)
        },
        registerUIWidget: (
          position: UIPosition,
          id: string,
          component: any,
          props?: Record<string, unknown>,
        ) => {
          registerUIWidget(
            plugin.id,
            position,
            id,
            component,
            props,
          )
        },
        unregisterUIWidget,
        events: globalEventBus,
        locale: i18n.global.locale.value,
        registerTranslations: (messages) => {
          for (const [lang, msgs] of Object.entries(messages)) {
            i18n.global.mergeLocaleMessage(lang, {
              plugins: {
                [plugin.id]: msgs as Record<string, unknown>,
              },
            })
          }
        },
        api: createApiFacade(),
      }

      // Add pages to router
      addPluginRoutes(plugin, router)

      // Activate plugin safely
      try {
        if (plugin.activate)
          await plugin.activate(ctx)

        plugins.push(plugin)
      }
      catch (err) {
        console.error(`[Plugin Manager] Failed to activate plugin "${plugin.id}":`, err)
        removePluginRoutes(plugin, router)
      }
    }
  }

  const uninstall = async (pluginId: string, router: Router) => {
    const index = plugins.findIndex(item => item.id === pluginId)
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
          registerUIWidget: () => { },
          unregisterUIWidget: () => { },
          events: globalEventBus,
          locale: i18n.global.locale.value,
          registerTranslations: () => { },
          api: createApiFacade(),
        }
        await plugin.deactivate(ctx)
      }
    }
    catch (err) {
      console.error(`[Plugin Manager] Error during deactivation of plugin "${pluginId}":`, err)
    }

    // Unregister widgets for this plugin
    for (let i = uiWidgets.length - 1; i >= 0; i--) {
      if (uiWidgets[i].pluginId === pluginId)
        uiWidgets.splice(i, 1)
    }

    // Remove pages from router
    removePluginRoutes(plugin, router)

    // Remove navigation items
    for (const item of navItemsByPlugin.get(plugin.id) ?? []) {
      const idx = navItems.indexOf(item)
      if (idx !== -1)
        navItems.splice(idx, 1)
    }

    navItemsByPlugin.delete(plugin.id)

    plugins.splice(index, 1)
    console.warn(`[Plugin Manager] Plugin "${pluginId}" uninstalled.`)
  }

  const fetchRemoteManifest = async (manifestUrl: string): Promise<{ manifest: InsightBookPluginManifest, remoteEntryUrl: string } | null> => {
    try {
      const manifestRes = await fetch(manifestUrl)
      if (!manifestRes.ok)
        throw new Error(`Failed to fetch manifest from ${manifestUrl}: status ${manifestRes.status}`)

      const manifest: InsightBookPluginManifest = await manifestRes.json()
      if (!manifest || !manifest.id || !manifest.entryUrl)
        throw new Error('Invalid manifest format: id and entryUrl are required.')

      const remoteEntryUrl = new URL(manifest.entryUrl, manifestUrl).toString()
      await saveCachedPlugin(
        manifest.id,
        manifestUrl,
        manifest,
        remoteEntryUrl,
      )

      return { manifest, remoteEntryUrl }
    }
    catch (netError) {
      console.warn(`[Plugin Manager] Network fetch failed for ${manifestUrl}. Trying offline cache...`, netError)
      const cached = await getCachedPlugin(manifestUrl) || await getCachedPlugin(manifestUrl.split('/').pop()?.replace('.json', '') || '')
      if (cached)
        return { manifest: cached.manifest, remoteEntryUrl: cached.remoteEntryUrl }

      console.error(`[Plugin Manager] Plugin at ${manifestUrl} could not be loaded from network or offline cache.`)

      return null
    }
  }

  const loadRemotePlugin = async (manifestUrl: string, router: Router): Promise<InsightBookPlugin | null> => {
    const fetchedData = await fetchRemoteManifest(manifestUrl)
    if (!fetchedData)
      return null

    const { manifest, remoteEntryUrl } = fetchedData

    try {
      ensureMfRuntime()

      const remoteName = toMfRemoteName(manifest.id)
      registerRemotes([{ name: remoteName, entry: remoteEntryUrl, type: 'module' }])

      const module = await loadRemote<{ default: InsightBookPlugin }>(`${remoteName}/Plugin`)

      if (!module || !module.default)
        throw new Error('Плагин не экспортирует default (InsightBookPlugin) из expose "./Plugin"')

      const plugin = module.default
      await install(null, router, [plugin])

      return plugin
    }
    catch (err) {
      console.error(`[Plugin Manager] Failed to load remote plugin via Module Federation from ${remoteEntryUrl}:`, err)

      return null
    }
  }

  return {
    install,
    uninstall,
    loadRemotePlugin,
    getWidgets,
    registerUIWidget,
    unregisterUIWidget,
    plugins,
    navItems,
    uiWidgets,
    events: globalEventBus,
  }
}

export const pluginManager = usePluginManager()
