import { ref } from 'vue'
import { useReaderStore } from '~/components/05.modules/reader/store/reader.store'
import { useToast } from '~/shared/composables/use-toast'
import { api } from '~/shared/services/api.service'
import { useGlobalSettingsStore } from '~/shared/store/settings.store'

export function useTts() {
  const readerStore = useReaderStore()
  const settingsStore = useGlobalSettingsStore()
  const toast = useToast()

  const isPlaying = ref(false)
  const isLoading = ref(false)

  let currentAudio: HTMLAudioElement | null = null
  let abortController: AbortController | null = null

  async function speak(text: string | null | undefined) {
    if (!text)
      return

    if (isLoading.value && abortController) {
      abortController.abort()
    }

    const bookId = readerStore.currentBook?.id
    if (!bookId) {
      console.warn('TTS: Невозможно озвучить, так как ID книги не найден')
      return
    }

    stop()

    isLoading.value = true
    abortController = new AbortController()

    try {
      const { audioBase64 } = await api.books.generateTts(bookId, text, abortController.signal)
      const audioSrc = `data:audio/mp3;base64,${audioBase64}`
      currentAudio = new Audio(audioSrc)

      currentAudio.playbackRate = settingsStore.ttsSpeed

      currentAudio.onplay = () => isPlaying.value = true
      currentAudio.onended = () => isPlaying.value = false

      await currentAudio.play()
    }
    catch (e: any) {
      if (e.name === 'AbortError')
        return

      console.error('TTS Error:', e)
      toast.error('Озвучка недоступна без интернета')
    }
    finally {
      if (abortController?.signal.aborted === false) {
        isLoading.value = false
      }
    }
  }

  function stop() {
    if (abortController) {
      abortController.abort()
      abortController = null
    }
    if (currentAudio) {
      currentAudio.pause()
      currentAudio = null
    }
    isPlaying.value = false
    isLoading.value = false
  }

  return { speak, stop, isPlaying, isLoading }
}
