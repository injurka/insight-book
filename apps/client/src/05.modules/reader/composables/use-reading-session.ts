import { onMounted, onUnmounted } from 'vue'
import { useTracking } from '~/01.shared/composables/use-tracking'
import { useReaderStore } from '~/05.modules/reader/store/reader.store'

export function useReadingSession() {
  const { trackEvent } = useTracking()
  const readerStore = useReaderStore()
  let readingSessionStartTime = 0

  onMounted(() => {
    readingSessionStartTime = Date.now()
  })

  onUnmounted(() => {
    const durationSeconds = Math.round((Date.now() - readingSessionStartTime) / 1000)
    if (durationSeconds > 10) {
      trackEvent('reading_session_ended', {
        duration_seconds: durationSeconds,
        book_id: readerStore.currentBook?.id,
      })
    }
  })
}
