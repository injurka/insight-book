import { ref } from 'vue'
import { useReaderStore } from '~/components/05.modules/reader/store/reader.store'
import { useToast } from '~/shared/composables/use-toast'
import { useUmami } from '~/shared/composables/use-umami'
import { api } from '~/shared/services/api.service'
import { offlineService } from '~/shared/services/offline.service'
import { useGlobalSettingsStore } from '~/shared/store/settings.store'

export function useTts() {
  const { trackEvent } = useUmami()

  const readerStore = useReaderStore()
  const settingsStore = useGlobalSettingsStore()
  const toast = useToast()

  const isPlaying = ref(false)
  const isLoading = ref(false)

  let currentAudio: HTMLAudioElement | null = null
  let currentAudioUrl: string | null = null
  let abortController: AbortController | null = null

  async function speak(text: string | null | undefined, explicitLanguage?: string, explicitBookId?: number) {
    if (!text)
      return

    const hasChineseChars = /[\u4E00-\u9FA5]/.test(text)
    const maxLength = hasChineseChars ? 80 : 250

    if (text.length > maxLength) {
      toast.error('Текст слишком длинный (максимум ~15 секунд звучания)')
      return
    }

    if (isLoading.value && abortController) {
      abortController.abort()
    }

    stop()

    isLoading.value = true
    abortController = new AbortController()

    try {
      const bookId = explicitBookId || readerStore.currentBook?.id
      const lang = explicitLanguage || readerStore.currentBook?.language || 'en'
      const voice = settingsStore.ttsVoice || 'Kore'

      const normalizedText = text.trim().toLowerCase()
      const cacheKey = bookId ? `${bookId}_${voice}_${normalizedText}` : `dict_${lang}_${voice}_${normalizedText}`

      let audioBlob = await offlineService.getTtsBlob(cacheKey)

      if (!audioBlob) {
        let audioBase64 = ''
        if (bookId) {
          const res = await api.books.generateTts(bookId, text, voice, abortController.signal)
          audioBase64 = res.audioBase64
        }
        else {
          const res = await api.tts.generate(text, voice, abortController.signal)
          audioBase64 = res.audioBase64
        }
        await offlineService.saveTts(cacheKey, audioBase64)
        audioBlob = await offlineService.getTtsBlob(cacheKey)
      }

      if (abortController.signal.aborted)
        return

      if (audioBlob) {
        currentAudioUrl = URL.createObjectURL(audioBlob)
        currentAudio = new Audio(currentAudioUrl)
        currentAudio.playbackRate = settingsStore.ttsSpeed

        currentAudio.onplay = () => isPlaying.value = true
        currentAudio.onended = () => {
          isPlaying.value = false
          if (currentAudioUrl) {
            URL.revokeObjectURL(currentAudioUrl)
            currentAudioUrl = null
          }
        }

        trackEvent('tts_played', { lang, voice })

        await currentAudio.play()
      }
    }
    catch (e) {
      const err = e as Error
      if (err.name === 'AbortError')
        return

      console.error('TTS Error:', err)
      toast.error('Озвучка недоступна без интернета или произошла ошибка сервера')
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
    if (currentAudioUrl) {
      URL.revokeObjectURL(currentAudioUrl)
      currentAudioUrl = null
    }
    isPlaying.value = false
    isLoading.value = false
  }

  return { speak, stop, isPlaying, isLoading }
}
