import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const invokeMock = vi.hoisted(() => vi.fn())

vi.mock('@tauri-apps/api/core', () => ({
  invoke: invokeMock,
}))

function setUserAgent(value: string) {
  Object.defineProperty(navigator, 'userAgent', {
    configurable: true,
    value,
  })
}

describe('native sync progress notification service', () => {
  const originalUserAgent = navigator.userAgent

  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  afterEach(() => {
    setUserAgent(originalUserAgent)
  })

  it('treats non-mobile or non-Android environments as unsupported no-ops', async () => {
    setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)')
    vi.doMock('~/01.shared/lib/env', () => ({ isMobileApp: true }))

    const service = await import('./native-sync-progress-notification.service')

    expect(service.isNativeSyncProgressNotificationSupported).toBe(false)
    await expect(service.requestNativeSyncProgressNotificationPermission()).resolves.toBe(false)
    await service.startNativeSyncProgressNotification({ title: 'Sync', body: '1/10', progress: 10 })
    await service.updateNativeSyncProgressNotification({ title: 'Sync', body: '5/10', progress: 50 })
    await service.stopNativeSyncProgressNotification()

    expect(invokeMock).not.toHaveBeenCalled()
  })

  it('requests notification permission and handles errors on Android mobile app', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    setUserAgent('Mozilla/5.0 (Linux; Android 14; Pixel 8)')
    vi.doMock('~/01.shared/lib/env', () => ({ isMobileApp: true }))

    const service = await import('./native-sync-progress-notification.service')

    expect(service.isNativeSyncProgressNotificationSupported).toBe(true)

    invokeMock.mockResolvedValueOnce(true)
    await expect(service.requestNativeSyncProgressNotificationPermission()).resolves.toBe(true)
    expect(invokeMock).toHaveBeenCalledWith('request_sync_notification_permission')

    invokeMock.mockRejectedValueOnce(new Error('denied'))
    await expect(service.requestNativeSyncProgressNotificationPermission()).resolves.toBe(false)
    expect(warnSpy).toHaveBeenCalled()
    warnSpy.mockRestore()
  })

  it('serializes start, update, and stop commands and recovers from failed commands', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    setUserAgent('Mozilla/5.0 (Linux; Android 14; Pixel 8)')
    vi.doMock('~/01.shared/lib/env', () => ({ isMobileApp: true }))

    const service = await import('./native-sync-progress-notification.service')

    const callOrder: string[] = []
    let releaseFirst!: () => void
    invokeMock.mockImplementation((command: string) => {
      callOrder.push(command)

      if (command === 'start_sync_progress_notification') {
        return new Promise<void>((resolve) => {
          releaseFirst = resolve
        })
      }

      if (command === 'update_sync_progress_notification')
        return Promise.reject(new Error('transient error'))

      return Promise.resolve()
    })

    const p1 = service.startNativeSyncProgressNotification({ title: 'Sync', body: 'Starting', progress: 0 })
    const p2 = service.updateNativeSyncProgressNotification({ title: 'Sync', body: 'Half', progress: 50 })
    const p3 = service.stopNativeSyncProgressNotification()

    await vi.waitFor(() => expect(callOrder).toEqual(['start_sync_progress_notification']))
    releaseFirst()
    await Promise.all([p1, p2, p3])

    expect(callOrder).toEqual([
      'start_sync_progress_notification',
      'update_sync_progress_notification',
      'stop_sync_progress_notification',
    ])
    expect(invokeMock).toHaveBeenNthCalledWith(1, 'start_sync_progress_notification', {
      title: 'Sync',
      body: 'Starting',
      progress: 0,
    })
    expect(invokeMock).toHaveBeenNthCalledWith(2, 'update_sync_progress_notification', {
      title: 'Sync',
      body: 'Half',
      progress: 50,
    })
    expect(invokeMock).toHaveBeenNthCalledWith(3, 'stop_sync_progress_notification', undefined)
    expect(warnSpy).toHaveBeenCalledWith('[Sync notification] update_sync_progress_notification failed:', expect.any(Error))
    warnSpy.mockRestore()
  })
})
