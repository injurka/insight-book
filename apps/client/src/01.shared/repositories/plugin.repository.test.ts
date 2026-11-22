import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DefaultPluginRepository } from './plugin.repository'

const mocks = vi.hoisted(() => ({
  getMyPlugins: vi.fn(),
  installPlugin: vi.fn(),
  updatePlugin: vi.fn(),
  uninstallPlugin: vi.fn(),
}))

vi.mock('~/01.shared/services/api.service', () => ({
  api: { plugins: mocks },
}))

describe('plugin repository', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('fetches and validates user plugins with ACL defaults', async () => {
    mocks.getMyPlugins.mockResolvedValue([
      {
        userId: 5,
        pluginId: 'dialogue-trainer',
        manifestUrl: 'https://cdn.example.test/manifest.json',
        isEnabled: 'broken-bool',
      },
    ])

    const repo = new DefaultPluginRepository()
    const plugins = await repo.getMyPlugins()

    expect(plugins).toEqual([
      {
        userId: 5,
        pluginId: 'dialogue-trainer',
        manifestUrl: 'https://cdn.example.test/manifest.json',
        settings: null,
        isEnabled: true,
      },
    ])
  })

  it('delegates installPlugin, updatePlugin, and uninstallPlugin to api.plugins', async () => {
    const installed = {
      userId: 5,
      pluginId: 'dialogue-trainer',
      manifestUrl: 'https://cdn.example.test/manifest.json',
      settings: '{}',
      isEnabled: true,
    }
    mocks.installPlugin.mockResolvedValue(installed)
    mocks.updatePlugin.mockResolvedValue({ ...installed, isEnabled: false })
    mocks.uninstallPlugin.mockResolvedValue({ success: true })

    const repo = new DefaultPluginRepository()

    await expect(repo.installPlugin({
      pluginId: 'dialogue-trainer',
      manifestUrl: 'https://cdn.example.test/manifest.json',
      settings: '{}',
      isEnabled: true,
    })).resolves.toEqual(installed)

    await expect(repo.updatePlugin('dialogue-trainer', { isEnabled: false }))
      .resolves
      .toEqual({ ...installed, isEnabled: false })
    expect(mocks.updatePlugin).toHaveBeenCalledWith('dialogue-trainer', { isEnabled: false })

    await expect(repo.uninstallPlugin('dialogue-trainer')).resolves.toEqual({ success: true })
    expect(mocks.uninstallPlugin).toHaveBeenCalledWith('dialogue-trainer')
  })
})
