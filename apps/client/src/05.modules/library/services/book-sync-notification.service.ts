import type { SyncNotificationProgress, SyncProgressNotificationOptions } from '../model'
import { watch } from 'vue'
import {
  startNativeSyncProgressNotification,
  stopNativeSyncProgressNotification,
  updateNativeSyncProgressNotification,
} from '~/01.shared/services/native-sync-progress-notification.service'

const UPDATE_INTERVAL_MS = 750

export function startBookSyncNotification(options: SyncProgressNotificationOptions, getProgress: () => SyncNotificationProgress): () => Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined
  let stopped = false

  function payload() {
    const progress = getProgress()

    return {
      title: options.title,
      body: options.formatProgress(progress),
      progress: progress.pagesTotal > 0
        ? Math.min(100, Math.floor((progress.pagesDone / progress.pagesTotal) * 100))
        : 0,
    }
  }

  void startNativeSyncProgressNotification(payload())

  const stopWatching = watch(getProgress, () => {
    if (timer !== undefined || stopped)
      return

    timer = setTimeout(() => {
      timer = undefined

      if (!stopped)
        void updateNativeSyncProgressNotification(payload())
    }, UPDATE_INTERVAL_MS)
  }, { deep: true, flush: 'sync' })

  return async () => {
    if (stopped)
      return

    stopped = true
    stopWatching()
    clearTimeout(timer)
    await stopNativeSyncProgressNotification()
  }
}
