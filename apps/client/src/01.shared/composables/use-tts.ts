import { ref } from 'vue'
import { useRepos } from '~/00.plugins/di'
import { useToast } from '~/01.shared/composables/use-toast'
import { useUmami } from '~/01.shared/composables/use-umami'
import { useGlobalSettingsStore } from '~/01.shared/store/settings.store'
import { useReaderStore } from '~/05.modules/reader/store/reader.store'

const isPlaying = ref(false)
const isLoading = ref(false)

let currentAudio: HTMLAudioElement | null = null
let currentAudioUrl: string | null = null
let abortController: AbortController | null = null

export function useTts() {
  const repos = useRepos()
  const { trackEvent } = useUmami()

  const readerStore = useReaderStore()
  const settingsStore = useGlobalSettingsStore()
  const toast = useToast()

  async function speak(
    text: string | null | undefined,
    explicitLanguage?: string,
    explicitBookId?: number,
    forceCacheBypass?: boolean,
  ) {
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

      let audioBlob = forceCacheBypass ? null : await repos.analysis.getLocalTts(cacheKey)

      if (!audioBlob) {
        let audioBase64 = ''
        if (bookId) {
          const res = await repos.analysis.generateTts(
            bookId,
            text,
            voice,
            abortController.signal,
          )
          audioBase64 = res.audioBase64
        }
        else {
          const res = await repos.analysis.generateGenericTts(
            text,
            voice,
            abortController.signal,
            forceCacheBypass,
          )
          audioBase64 = res.audioBase64
        }
        await repos.analysis.saveLocalTts(cacheKey, audioBase64)
        audioBlob = await repos.analysis.getLocalTts(cacheKey)
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
      const isAbort
        = err.name === 'AbortError'
          || err.name === 'CanceledError'
          || err.message?.toLowerCase().includes('abort')
          || err.message?.toLowerCase().includes('cancel')
          || err.message?.includes('is aborted')

      if (isAbort) {
        return
      }

      console.error('TTS Error:', err)
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
