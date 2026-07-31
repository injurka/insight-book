import type { InsightBookPlugin, InsightBookPluginContext } from '@injurka/insight-book-plugin-api'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'

import { usePluginManager } from './plugin-manager'

const { mockLoadRemote, mockRegisterRemotes, mockInit } = vi.hoisted(() => ({
  mockLoadRemote: vi.fn(),
  mockRegisterRemotes: vi.fn(),
  mockInit: vi.fn(),
}))

vi.mock('@module-federation/enhanced/runtime', () => ({
  init: mockInit,
  registerRemotes: mockRegisterRemotes,
  loadRemote: mockLoadRemote,
}))

vi.mock('~/00.plugins/di', () => ({
  defaultRepositories: {
    dictionary: {
      submitReview: vi.fn(),
    },
  },
}))

vi.mock('./plugin-storage', () => ({
  saveCachedPlugin: vi.fn(),
  getCachedPlugin: vi.fn(),
  removeCachedPlugin: vi.fn(),
}))

function createTestComponent(name: string) {
  return defineComponent({
    name,
    setup() {
      return () => h('div', name)
    },
  })
}

function createTestPlugin(overrides: Partial<InsightBookPlugin> = {}): InsightBookPlugin {
  return {
    id: 'test-plugin',
    name: 'Test Plugin',
    version: '1.0.0',
    ...overrides,
  }
}

function createTestRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'home', component: createTestComponent('HomePage') },
    ],
  })
}

describe('usePluginManager - install', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('adds plugin pages to the router with derived paths and names', async () => {
    const manager = usePluginManager()
    const router = createTestRouter()
    const plugin = createTestPlugin({
      pages: {
        index: createTestComponent('PluginIndex'),
        settings: createTestComponent('PluginSettings'),
      },
    })

    await manager.install(null, router, [plugin])

    expect(router.hasRoute('plugin-test-plugin-index')).toBe(true)
    expect(router.hasRoute('plugin-test-plugin-settings')).toBe(true)

    const indexRoute = router.getRoutes().find(r => r.name === 'plugin-test-plugin-index')
    const settingsRoute = router.getRoutes().find(r => r.name === 'plugin-test-plugin-settings')
    expect(indexRoute?.path).toBe('/plugin/test-plugin')
    expect(settingsRoute?.path).toBe('/plugin/test-plugin/settings')
  })

  it('pushes the plugin into plugins list after successful activation', async () => {
    const manager = usePluginManager()
    const router = createTestRouter()
    const activate = vi.fn()
    const plugin = createTestPlugin({ activate })

    await manager.install(null, router, [plugin])

    expect(activate).toHaveBeenCalledTimes(1)
    expect(manager.plugins).toHaveLength(1)
    expect(manager.plugins[0].id).toBe('test-plugin')
  })

  it('registers UI widgets via plugin context into correct positions', async () => {
    const manager = usePluginManager()
    const router = createTestRouter()
    const widgetComponent = createTestComponent('TrainingWidget')

    const plugin = createTestPlugin({
      activate(ctx: InsightBookPluginContext) {
        ctx.registerUIWidget(
          'dictionary:training-modes',
          'training-widget',
          widgetComponent,
          { level: 1 },
        )
        ctx.registerUIWidget('reader:header-actions', 'header-widget', widgetComponent)
      },
    })

    await manager.install(null, router, [plugin])

    expect(manager.uiWidgets).toHaveLength(2)

    const trainingWidgets = manager.getWidgets('dictionary:training-modes')
    expect(trainingWidgets).toHaveLength(1)
    expect(trainingWidgets[0]).toMatchObject({
      id: 'training-widget',
      position: 'dictionary:training-modes',
      pluginId: 'test-plugin',
      props: { level: 1 },
    })

    const headerWidgets = manager.getWidgets('reader:header-actions')
    expect(headerWidgets).toHaveLength(1)
    expect(headerWidgets[0].id).toBe('header-widget')

    expect(manager.getWidgets('settings:custom-tab')).toHaveLength(0)
  })

  it('adds navigation items via plugin context', async () => {
    const manager = usePluginManager()
    const router = createTestRouter()

    const plugin = createTestPlugin({
      activate(ctx: InsightBookPluginContext) {
        ctx.addNavigationItem({ title: 'Test', routeName: 'plugin-test-plugin-index' })
      },
    })

    await manager.install(null, router, [plugin])

    expect(manager.navItems).toHaveLength(1)
    expect(manager.navItems[0].routeName).toBe('plugin-test-plugin-index')
  })

  it('removes nav items with arbitrary routeName on uninstall', async () => {
    const manager = usePluginManager()
    const router = createTestRouter()

    const plugin = createTestPlugin({
      activate(ctx: InsightBookPluginContext) {
        ctx.addNavigationItem({ title: 'Custom', routeName: 'totally-custom-route' })
      },
    })

    await manager.install(null, router, [plugin])
    expect(manager.navItems).toHaveLength(1)

    await manager.uninstall('test-plugin', router)
    expect(manager.navItems).toHaveLength(0)
  })

  it('skips installation when plugin with same id is already installed', async () => {
    const manager = usePluginManager()
    const router = createTestRouter()
    const plugin = createTestPlugin()

    await manager.install(null, router, [plugin])
    await manager.install(null, router, [plugin])

    expect(manager.plugins).toHaveLength(1)
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('already installed'))
  })

  it('rolls back routes and does not register plugin when activation fails', async () => {
    const manager = usePluginManager()
    const router = createTestRouter()
    const plugin = createTestPlugin({
      pages: {
        index: createTestComponent('BrokenIndex'),
        extra: createTestComponent('BrokenExtra'),
      },
      activate() {
        throw new Error('activation boom')
      },
    })

    await manager.install(null, router, [plugin])

    expect(manager.plugins).toHaveLength(0)
    expect(router.hasRoute('plugin-test-plugin-index')).toBe(false)
    expect(router.hasRoute('plugin-test-plugin-extra')).toBe(false)
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Failed to activate plugin'), expect.any(Error))
  })

  it('installs plugin without pages and without activate hook', async () => {
    const manager = usePluginManager()
    const router = createTestRouter()
    const plugin = createTestPlugin()

    await manager.install(null, router, [plugin])

    expect(manager.plugins).toHaveLength(1)
    expect(router.getRoutes()).toHaveLength(1) // only the initial home route
  })
})

describe('usePluginManager - widgets registry', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('registerUIWidget replaces an existing widget with the same id', () => {
    const manager = usePluginManager()
    const first = createTestComponent('First')
    const second = createTestComponent('Second')

    manager.registerUIWidget(
      'plugin-a',
      'reader:header-actions',
      'widget-1',
      first,
    )
    manager.registerUIWidget(
      'plugin-b',
      'reader:header-actions',
      'widget-1',
      second,
      { v: 2 },
    )

    expect(manager.uiWidgets).toHaveLength(1)
    // uiWidgets is a reactive array, so the component is wrapped in a reactive proxy
    expect(manager.uiWidgets[0].component.name).toBe('Second')
    expect(manager.uiWidgets[0].pluginId).toBe('plugin-b')
    expect(manager.uiWidgets[0].props).toEqual({ v: 2 })
  })

  it('unregisterUIWidget removes only the matching widget', () => {
    const manager = usePluginManager()

    manager.registerUIWidget(
      'plugin-a',
      'reader:header-actions',
      'widget-1',
      createTestComponent('A'),
    )
    manager.registerUIWidget(
      'plugin-a',
      'reader:header-actions',
      'widget-2',
      createTestComponent('B'),
    )
    manager.unregisterUIWidget('widget-1')

    expect(manager.uiWidgets).toHaveLength(1)
    expect(manager.uiWidgets[0].id).toBe('widget-2')

    // Unregistering an unknown id is a no-op
    manager.unregisterUIWidget('unknown')
    expect(manager.uiWidgets).toHaveLength(1)
  })
})

describe('usePluginManager - uninstall', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  async function installFullPlugin() {
    const manager = usePluginManager()
    const router = createTestRouter()
    const deactivate = vi.fn()

    const plugin = createTestPlugin({
      pages: {
        index: createTestComponent('PluginIndex'),
        settings: createTestComponent('PluginSettings'),
      },
      activate(ctx: InsightBookPluginContext) {
        ctx.registerUIWidget('dictionary:training-modes', 'training-widget', createTestComponent('TrainingWidget'))
        ctx.registerUIWidget('reader:header-actions', 'header-widget', createTestComponent('HeaderWidget'))
        ctx.addNavigationItem({ title: 'Test', routeName: 'plugin-test-plugin-index' })
        ctx.addNavigationItem({ title: 'Settings', routeName: 'plugin-test-plugin-settings' })
      },
      deactivate,
    })

    await manager.install(null, router, [plugin])
    return { manager, router, plugin, deactivate }
  }

  it('removes routes, widgets, nav items and calls deactivate on uninstall', async () => {
    const { manager, router, deactivate } = await installFullPlugin()

    expect(manager.plugins).toHaveLength(1)
    expect(manager.uiWidgets).toHaveLength(2)
    expect(manager.navItems).toHaveLength(2)
    expect(router.hasRoute('plugin-test-plugin-index')).toBe(true)
    expect(router.hasRoute('plugin-test-plugin-settings')).toBe(true)

    await manager.uninstall('test-plugin', router)

    expect(deactivate).toHaveBeenCalledTimes(1)
    expect(manager.plugins).toHaveLength(0)
    expect(manager.uiWidgets).toHaveLength(0)
    expect(manager.navItems).toHaveLength(0)
    expect(router.hasRoute('plugin-test-plugin-index')).toBe(false)
    expect(router.hasRoute('plugin-test-plugin-settings')).toBe(false)
  })

  it('removes only widgets belonging to the uninstalled plugin', async () => {
    const manager = usePluginManager()
    const router = createTestRouter()

    const pluginA = createTestPlugin({
      id: 'plugin-a',
      activate(ctx: InsightBookPluginContext) {
        ctx.registerUIWidget('reader:header-actions', 'widget-a', createTestComponent('A'))
      },
    })
    const pluginB = createTestPlugin({
      id: 'plugin-b',
      activate(ctx: InsightBookPluginContext) {
        ctx.registerUIWidget('reader:header-actions', 'widget-b', createTestComponent('B'))
      },
    })

    await manager.install(null, router, [pluginA, pluginB])
    await manager.uninstall('plugin-a', router)

    expect(manager.uiWidgets).toHaveLength(1)
    expect(manager.uiWidgets[0].id).toBe('widget-b')
    expect(manager.plugins).toHaveLength(1)
    expect(manager.plugins[0].id).toBe('plugin-b')
  })

  it('uninstalls plugin even when deactivate throws', async () => {
    const manager = usePluginManager()
    const router = createTestRouter()
    const plugin = createTestPlugin({
      pages: { index: createTestComponent('PluginIndex') },
      deactivate() {
        throw new Error('deactivation boom')
      },
    })

    await manager.install(null, router, [plugin])
    await manager.uninstall('test-plugin', router)

    expect(manager.plugins).toHaveLength(0)
    expect(router.hasRoute('plugin-test-plugin-index')).toBe(false)
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Error during deactivation'), expect.any(Error))
  })

  it('warns and does nothing when uninstalling a plugin that is not installed', async () => {
    const manager = usePluginManager()
    const router = createTestRouter()

    await manager.uninstall('missing-plugin', router)

    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('"missing-plugin" is not installed'))
    expect(manager.plugins).toHaveLength(0)
  })
})

describe('usePluginManager - loadRemotePlugin', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('fetches manifest, loads remote module and installs the plugin', async () => {
    const manager = usePluginManager()
    const router = createTestRouter()
    const plugin = createTestPlugin({
      pages: { index: createTestComponent('RemoteIndex') },
    })

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 'test-plugin',
        name: 'Test Plugin',
        version: '1.0.0',
        entryUrl: './remoteEntry.js',
      }),
    }))
    mockLoadRemote.mockResolvedValue({ default: plugin })

    const result = await manager.loadRemotePlugin('https://plugins.example.com/test/manifest.json', router)

    expect(result).toBe(plugin)
    expect(mockInit).toHaveBeenCalledWith({ name: 'insight_book_host', remotes: [] })
    expect(mockRegisterRemotes).toHaveBeenCalledWith([{
      name: 'plugin_test_plugin',
      entry: 'https://plugins.example.com/test/remoteEntry.js',
    }])
    expect(mockLoadRemote).toHaveBeenCalledWith('plugin_test_plugin/Plugin')
    expect(manager.plugins).toHaveLength(1)
    expect(router.hasRoute('plugin-test-plugin-index')).toBe(true)
  })

  it('returns null when manifest is invalid and offline cache is empty', async () => {
    const manager = usePluginManager()
    const router = createTestRouter()

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ name: 'no-id-no-entry' }),
    }))

    const result = await manager.loadRemotePlugin('https://plugins.example.com/broken/manifest.json', router)

    expect(result).toBeNull()
    expect(manager.plugins).toHaveLength(0)
    expect(mockLoadRemote).not.toHaveBeenCalled()
  })

  it('returns null when remote module does not export a default plugin', async () => {
    const manager = usePluginManager()
    const router = createTestRouter()

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 'bad-plugin',
        name: 'Bad',
        version: '0.1.0',
        entryUrl: './remoteEntry.js',
      }),
    }))
    mockLoadRemote.mockResolvedValue({})

    const result = await manager.loadRemotePlugin('https://plugins.example.com/bad/manifest.json', router)

    expect(result).toBeNull()
    expect(manager.plugins).toHaveLength(0)
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Failed to load remote plugin'), expect.any(Error))
  })

  it('falls back to offline cache when manifest fetch fails', async () => {
    const { getCachedPlugin } = await import('./plugin-storage')
    const cachedPlugin = createTestPlugin({ id: 'cached-plugin' })

    vi.mocked(getCachedPlugin).mockResolvedValue({
      pluginId: 'cached-plugin',
      manifestUrl: 'https://plugins.example.com/cached/manifest.json',
      manifest: {
        id: 'cached-plugin',
        name: 'Cached',
        version: '2.0.0',
        entryUrl: './remoteEntry.js',
      },
      remoteEntryUrl: 'https://plugins.example.com/cached/remoteEntry.js',
      updatedAt: Date.now(),
    })

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')))
    mockLoadRemote.mockResolvedValue({ default: cachedPlugin })

    const manager = usePluginManager()
    const router = createTestRouter()

    const result = await manager.loadRemotePlugin('https://plugins.example.com/cached/manifest.json', router)

    expect(result).toBe(cachedPlugin)
    expect(manager.plugins).toHaveLength(1)
    expect(manager.plugins[0].id).toBe('cached-plugin')
  })
})
