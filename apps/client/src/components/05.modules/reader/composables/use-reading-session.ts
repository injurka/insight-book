import { onMounted, onUnmounted } from 'vue'
import { useUmami } from '~/shared/composables/use-umami'
import { useReaderStore } from '../store/reader.store'

export function useReadingSession() {
  const { trackEvent } = useUmami()
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
