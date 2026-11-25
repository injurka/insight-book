import { onMounted, onUnmounted } from 'vue'
import { useTracking } from '~/01.shared/composables/use-tracking'
import { useReaderStore } from '~/05.modules/reader'

const MIN_SESSION_SECONDS = 10

export function useReadingSession() {
  const { trackEvent } = useTracking()
  const readerStore = useReaderStore()

  let accumulatedVisibleMs = 0
  let visibleSinceMs: number | null = null
  let activeBookId: number | undefined
  let hasEmitted = false

  function isDocumentVisible(): boolean {
    return typeof document === 'undefined' || document.visibilityState === 'visible'
  }

  function pauseClock(now: number = Date.now()): void {
    if (visibleSinceMs !== null) {
      accumulatedVisibleMs += Math.max(0, now - visibleSinceMs)
      visibleSinceMs = null
    }
  }

  function resumeClock(now: number = Date.now()): void {
    if (visibleSinceMs === null && isDocumentVisible())
      visibleSinceMs = now
  }

  function emitSessionEnded(): void {
    if (hasEmitted)
      return

    pauseClock()
    const durationSeconds = Math.round(accumulatedVisibleMs / 1000)

    if (durationSeconds >= MIN_SESSION_SECONDS) {
      hasEmitted = true
      trackEvent('reading_session_ended', {
        duration_seconds: durationSeconds,
        book_id: readerStore.currentBook?.id ?? activeBookId,
      })
    }
  }

  function onVisibilityChange(): void {
    if (document.visibilityState === 'hidden')
      pauseClock()
    else
      resumeClock()
  }

  onMounted(() => {
    activeBookId = readerStore.currentBook?.id
    hasEmitted = false
    accumulatedVisibleMs = 0
    resumeClock()

    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('pagehide', emitSessionEnded)
  })

  onUnmounted(() => {
    emitSessionEnded()
    document.removeEventListener('visibilitychange', onVisibilityChange)
    window.removeEventListener('pagehide', emitSessionEnded)
  })
}
