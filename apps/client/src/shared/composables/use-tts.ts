import { ref } from 'vue'
import { useReaderStore } from '~/components/05.modules/reader/store/reader.store'
import { api } from '~/shared/services/api.service'

export function useTts() {
  const readerStore = useReaderStore()
  const isPlaying = ref(false)
  const isLoading = ref(false)
  let currentAudio: HTMLAudioElement | null = null

  async function speak(text: string | null | undefined) {
    if (!text || isLoading.value)
      return

    const bookId = readerStore.currentBook?.id
    if (!bookId) {
      console.warn('TTS: Невозможно озвучить, так как ID книги не найден')
      return
    }

    stop()
    isLoading.value = true

    try {
      const { audioBase64 } = await api.books.generateTts(bookId, text)
      const audioSrc = `data:audio/mp3;base64,${audioBase64}`
      currentAudio = new Audio(audioSrc)

      currentAudio.onplay = () => isPlaying.value = true
      currentAudio.onended = () => isPlaying.value = false

      await currentAudio.play()
    }
    catch (e) {
      console.error('TTS Error:', e)
    }
    finally {
      isLoading.value = false
    }
  }

  function stop() {
    if (currentAudio) {
      currentAudio.pause()
      currentAudio = null
      isPlaying.value = false
    }
  }

  return { speak, stop, isPlaying, isLoading }
}
