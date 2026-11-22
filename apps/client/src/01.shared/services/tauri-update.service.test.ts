import type { Pinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const checkForUpdatesMock = vi.hoisted(() => vi.fn())
const useAppUpdateStoreMock = vi.hoisted(() => vi.fn(() => ({
  checkForUpdates: checkForUpdatesMock,
})))

vi.mock('~/01.shared/store/app-update.store', () => ({
  useAppUpdateStore: useAppUpdateStoreMock,
}))

const fakePinia = {} as Pinia

describe('tauri update service', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('returns false and skips store access outside Tauri', async () => {
    vi.doMock('~/01.shared/lib/env', () => ({ isTauri: false }))

    const { checkForTauriUpdate, initializeTauriUpdater } = await import('./tauri-update.service')

    await expect(checkForTauriUpdate(fakePinia)).resolves.toBe(false)
    await expect(initializeTauriUpdater(fakePinia)).resolves.toBeUndefined()
    expect(useAppUpdateStoreMock).not.toHaveBeenCalled()
    expect(checkForUpdatesMock).not.toHaveBeenCalled()
  })

  it('delegates manual and startup update checks to appUpdateStore inside Tauri', async () => {
    vi.doMock('~/01.shared/lib/env', () => ({ isTauri: true }))
    checkForUpdatesMock.mockResolvedValueOnce(true).mockResolvedValueOnce(false)

    const { checkForTauriUpdate, initializeTauriUpdater } = await import('./tauri-update.service')

    await expect(checkForTauriUpdate(fakePinia, true)).resolves.toBe(true)
    expect(useAppUpdateStoreMock).toHaveBeenCalledWith(fakePinia)
    expect(checkForUpdatesMock).toHaveBeenNthCalledWith(1, false)

    await initializeTauriUpdater(fakePinia)
    expect(checkForUpdatesMock).toHaveBeenNthCalledWith(2, true)
  })
})
