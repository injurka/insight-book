import { invoke } from '@tauri-apps/api/core'
import { isMobileApp } from '~/01.shared/lib/env'

export interface NativeSyncProgressNotification {
  title: string
  body: string
  progress: number
}

export const isNativeSyncProgressNotificationSupported = isMobileApp && /android/i.test(navigator.userAgent)

let notificationCommandQueue: Promise<void> = Promise.resolve()

function enqueueNotificationCommand(command: string, args?: Record<string, unknown>): Promise<void> {
  if (!isNativeSyncProgressNotificationSupported)
    return Promise.resolve()

  notificationCommandQueue = notificationCommandQueue
    .then(() => invoke(command, args))
    .then(() => undefined)
    .catch((error: unknown) => {
      console.warn(`[Sync notification] ${command} failed:`, error)
    })

  return notificationCommandQueue
}

export async function requestNativeSyncProgressNotificationPermission(): Promise<boolean> {
  if (!isNativeSyncProgressNotificationSupported)
    return false

  try {
    return await invoke<boolean>('request_sync_notification_permission')
  }
  catch (error) {
    console.warn('[Sync notification] Permission request failed:', error)

    return false
  }
}

export function startNativeSyncProgressNotification(notification: NativeSyncProgressNotification): Promise<void> {
  return enqueueNotificationCommand('start_sync_progress_notification', {
    title: notification.title,
    body: notification.body,
    progress: notification.progress,
  })
}

export function updateNativeSyncProgressNotification(notification: NativeSyncProgressNotification): Promise<void> {
  return enqueueNotificationCommand('update_sync_progress_notification', {
    title: notification.title,
    body: notification.body,
    progress: notification.progress,
  })
}

export function stopNativeSyncProgressNotification(): Promise<void> {
  return enqueueNotificationCommand('stop_sync_progress_notification')
}
