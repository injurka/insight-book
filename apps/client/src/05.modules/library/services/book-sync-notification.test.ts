import type { SyncNotificationProgress } from '../model'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { reactive } from 'vue'
import { startBookSyncNotification } from './book-sync-notification.service'

const native = vi.hoisted(() => ({
  startNativeSyncProgressNotification: vi.fn().mockResolvedValue(undefined),
  updateNativeSyncProgressNotification: vi.fn().mockResolvedValue(undefined),
  stopNativeSyncProgressNotification: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('~/01.shared/services/native-sync-progress-notification.service', () => native)

function createProgress(): SyncNotificationProgress {
  return reactive({
    phase: 'preparing',
    currentPage: 0,
    pagesDone: 6,
    pagesTotal: 536,
    sentencesDone: 0,
    sentencesFromCache: 0,
    wordsDone: 0,
    wordsFromCache: 0,
    ttsDone: 0,
    ttsFromCache: 0,
  })
}

const options = {
  title: 'Book title',
  formatProgress: (p: SyncNotificationProgress) => `${p.phase}: ${p.sentencesDone} sentences, ${p.ttsDone} audio`,
}

describe('book sync notification lifecycle', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('updates analysis and audio inside a page and coalesces rapid changes', async () => {
    const progress = createProgress()
    const stop = startBookSyncNotification(options, () => ({ ...progress }))

    expect(native.startNativeSyncProgressNotification).toHaveBeenCalledWith({
      title: 'Book title',
      body: 'preparing: 0 sentences, 0 audio',
      progress: 1,
    })

    progress.phase = 'sentences'
    progress.sentencesDone = 15
    progress.sentencesDone = 20
    await vi.advanceTimersByTimeAsync(749)
    expect(native.updateNativeSyncProgressNotification).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(1)
    expect(native.updateNativeSyncProgressNotification).toHaveBeenCalledTimes(1)
    expect(native.updateNativeSyncProgressNotification).toHaveBeenLastCalledWith({
      title: 'Book title',
      body: 'sentences: 20 sentences, 0 audio',
      progress: 1,
    })

    progress.phase = 'audio'
    progress.ttsDone = 12
    await vi.advanceTimersByTimeAsync(750)
    expect(native.updateNativeSyncProgressNotification).toHaveBeenLastCalledWith({
      title: 'Book title',
      body: 'audio: 20 sentences, 12 audio',
      progress: 1,
    })

    await stop()
  })

  it('cancels a pending update and cannot recreate the notification after stopping', async () => {
    const progress = createProgress()
    const stop = startBookSyncNotification(options, () => ({ ...progress }))

    progress.ttsDone = 5
    await stop()
    progress.ttsDone = 10
    await vi.runAllTimersAsync()
    await stop()

    expect(native.updateNativeSyncProgressNotification).not.toHaveBeenCalled()
    expect(native.stopNativeSyncProgressNotification).toHaveBeenCalledTimes(1)
  })
})
