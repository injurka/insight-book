import { watch } from 'vue'
import {
  startNativeSyncProgressNotification,
  stopNativeSyncProgressNotification,
  updateNativeSyncProgressNotification,
} from '~/01.shared/services/native-sync-progress-notification.service'

interface GenerationProgress {
  done: number
  total: number
  word: string
}

const UPDATE_INTERVAL_MS = 750

export function startBookDeckGenerationNotification(title: string, getProgress: () => GenerationProgress, formatProgress: (progress: GenerationProgress) => string): () => Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined
  let stopped = false

  function payload() {
    const progress = getProgress()

    return {
      title,
      body: formatProgress(progress),
      progress: progress.total > 0
        ? Math.min(100, Math.floor((progress.done / progress.total) * 100))
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
