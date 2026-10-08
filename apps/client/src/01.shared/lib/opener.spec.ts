import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { openExternalUrl } from './opener'

const native = vi.hoisted(() => ({ isTauri: false, openUrl: vi.fn() }))
vi.mock('./env', () => native)
vi.mock('@tauri-apps/plugin-opener', () => ({ openUrl: native.openUrl }))
beforeEach(() => {
  native.isTauri = false
  native.openUrl.mockReset()
  vi.spyOn(window, 'open').mockReturnValue(null)
})
afterEach(() => vi.restoreAllMocks())

describe('openExternalUrl', () => {
  it('ignores empty URLs', async () => {
    await openExternalUrl('')
    expect(window.open).not.toHaveBeenCalled()
    expect(native.openUrl).not.toHaveBeenCalled()
  })
  it('opens web URLs without access to the opener', async () => {
    await openExternalUrl('https://example.com')
    expect(window.open).toHaveBeenCalledWith('https://example.com', '_blank', 'noopener,noreferrer')
    await openExternalUrl('https://example.com', '_self')
    expect(window.open).toHaveBeenLastCalledWith('https://example.com', '_self', 'noopener,noreferrer')
  })
  it('uses the native opener in Tauri', async () => {
    native.isTauri = true
    await openExternalUrl('https://example.com')
    expect(native.openUrl).toHaveBeenCalledWith('https://example.com')
    expect(window.open).not.toHaveBeenCalled()
  })
  it('falls back to the browser when the native opener fails', async () => {
    native.isTauri = true
    native.openUrl.mockRejectedValue(new Error('native failed'))
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    await openExternalUrl('https://example.com')
    expect(window.open).toHaveBeenCalledOnce()
  })
})
