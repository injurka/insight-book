import { ref } from 'vue'
import { useReaderStore } from '~/components/05.modules/reader/store/reader.store'
import { useToast } from '~/shared/composables/use-toast'
import { api } from '~/shared/services/api.service'
import { offlineService } from '~/shared/services/offline.service'
import { useGlobalSettingsStore } from '~/shared/store/settings.store'

export function useTts() {
  const readerStore = useReaderStore()
  const settingsStore = useGlobalSettingsStore()
  const toast = useToast()

  const isPlaying = ref(false)
  const isLoading = ref(false)

  let currentAudio: HTMLAudioElement | null = null
  let abortController: AbortController | null = null

  async function speak(text: string | null | undefined, explicitLanguage?: string) {
    if (!text)
      return

    if (isLoading.value && abortController) {
      abortController.abort()
    }

    stop()

    isLoading.value = true
    abortController = new AbortController()

    try {
      const bookId = readerStore.currentBook?.id
      const lang = explicitLanguage || readerStore.currentBook?.language || 'en'

      const cacheKey = bookId ? `${bookId}_${text}` : `dict_${lang}_${text}`
      let audioBase64 = await offlineService.getTts(cacheKey)

      if (!audioBase64) {
        if (bookId) {
          const res = await api.books.generateTts(bookId, text, abortController.signal)
          audioBase64 = res.audioBase64
        }
        else {
          const res = await api.tts.generate(text, lang, abortController.signal)
          audioBase64 = res.audioBase64
        }
        await offlineService.saveTts(cacheKey, audioBase64)
      }

      if (abortController.signal.aborted)
        return

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
