import { ref } from 'vue'
import { useRepos } from '~/00.plugins/di'
import { useToast } from '~/01.shared/composables/use-toast'
import { useTracking } from '~/01.shared/composables/use-tracking'
import { useGlobalSettingsStore } from '~/01.shared/store/settings.store'
import { useReaderStore } from '~/05.modules/reader/store/reader.store'

const isPlaying = ref(false)
const isLoading = ref(false)

let currentAudio: HTMLAudioElement | null = null
let currentAudioUrl: string | null = null
let abortController: AbortController | null = null

export function useTts() {
  const repos = useRepos()
  const { trackEvent } = useTracking()

  const readerStore = useReaderStore()
  const settingsStore = useGlobalSettingsStore()
  const toast = useToast()

  async function getOrGenerateAudioBlob(
    bookId: number | undefined,
    lang: string,
    voice: string,
    normalizedText: string,
    text: string,
    forceCacheBypass: boolean | undefined,
    signal: AbortSignal,
  ) {
    const cacheKey = bookId ? `${bookId}_${voice}_${normalizedText}` : `dict_${lang}_${voice}_${normalizedText}`
    let audioBlob = forceCacheBypass ? null : await repos.analysis.getLocalTts(cacheKey)

    if (!audioBlob) {
      let audioBase64 = ''
      if (bookId) {
        const res = await repos.analysis.generateTts(
          bookId,
          text,
          voice,
          signal,
        )
        audioBase64 = res.audioBase64
      }
      else {
        const res = await repos.analysis.generateGenericTts(
          text,
          voice,
          signal,
          forceCacheBypass,
        )
        audioBase64 = res.audioBase64
      }

      await repos.analysis.saveLocalTts(cacheKey, audioBase64)
      audioBlob = await repos.analysis.getLocalTts(cacheKey)
    }

    return audioBlob
  }

  function isAbortError(err: Error) {
    return err.name === 'AbortError'
      || err.name === 'CanceledError'
      || err.message?.toLowerCase().includes('abort')
      || err.message?.toLowerCase().includes('cancel')
      || err.message?.includes('is aborted')
  }

  async function playAudioBlob(audioBlob: Blob, lang: string, voice: string) {
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

  function validateText(text: string): boolean {
    const hasChineseChars = /[\u4E00-\u9FA5]/.test(text)
    const maxLength = hasChineseChars ? 80 : 250

    if (text.length > maxLength) {
      toast.error('Текст слишком длинный (максимум ~15 секунд звучания)')

      return false
    }

    return true
  }

  function getTtsParams(explicitLanguage?: string, explicitBookId?: number) {
    const bookId = explicitBookId || readerStore.currentBook?.id
    const lang = explicitLanguage || readerStore.currentBook?.language || 'en'
    const voice = settingsStore.ttsVoice || 'Kore'

    return { bookId, lang, voice }
  }

  function abortIfLoading() {
    if (isLoading.value && abortController)
      abortController.abort()
  }

  async function speak(
    text: string | null | undefined,
    explicitLanguage?: string,
    explicitBookId?: number,
    forceCacheBypass?: boolean,
  ): Promise<boolean> {
    if (!text || !validateText(text))
      return false

    abortIfLoading()
    stop()

    isLoading.value = true
    const controller = new AbortController()
    abortController = controller

    try {
      const { bookId, lang, voice } = getTtsParams(explicitLanguage, explicitBookId)
      const normalizedText = text.trim().toLowerCase()

      const audioBlob = await getOrGenerateAudioBlob(
        bookId,
        lang,
        voice,
        normalizedText,
        text,
        forceCacheBypass,
        controller.signal,
      )

      if (controller.signal.aborted)
        return false

      if (!audioBlob)
        return false

      await playAudioBlob(audioBlob, lang, voice)

      return true
    }
    catch (e) {
      if (!isAbortError(e as Error))
        console.error('TTS Error:', e)

      return false
    }
    finally {
      if (abortController === controller)
        isLoading.value = false
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
