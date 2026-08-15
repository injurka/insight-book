import { ref } from 'vue'
import { useRepos } from '~/00.plugins/di'
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

  function getSpeechSynthesisLang(lang: string): string {
    const lower = lang.toLowerCase()
    if (lower.startsWith('zh'))
      return 'zh-CN'
    if (lower.startsWith('ru'))
      return 'ru-RU'

    return 'en-US'
  }

  function pickVoice(langCode: string, lang: string): SpeechSynthesisVoice | null {
    if (typeof window === 'undefined' || !('speechSynthesis' in window))
      return null

    const voices = window.speechSynthesis.getVoices()
    if (!voices || voices.length === 0)
      return null

    return voices.find(v =>
      v.lang.toLowerCase().replace('_', '-').startsWith(langCode.toLowerCase())
      || v.lang.toLowerCase().startsWith(lang.toLowerCase())) || null
  }

  function speakWithWebSpeech(text: string, lang: string, rate: number = 1): Promise<boolean> {
    return new Promise((resolve) => {
      if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
        resolve(false)

        return
      }

      try {
        window.speechSynthesis.cancel()
        const langCode = getSpeechSynthesisLang(lang)
        const utterance = new SpeechSynthesisUtterance(text)
        utterance.lang = langCode
        utterance.rate = rate || 1

        const match = pickVoice(langCode, lang)
        if (match) {
          utterance.voice = match
        }

        utterance.onstart = () => {
          isPlaying.value = true
        }

        utterance.onend = () => {
          isPlaying.value = false
          resolve(true)
        }

        utterance.onerror = (e) => {
          if (e.error !== 'interrupted' && e.error !== 'canceled') {
            console.warn('[Web Speech TTS Error]', e)
          }

          isPlaying.value = false
          resolve(false)
        }

        isPlaying.value = true
        window.speechSynthesis.speak(utterance)
      }
      catch (err) {
        console.warn('[Web Speech TTS Exception]', err)
        isPlaying.value = false
        resolve(false)
      }
    })
  }

  async function fallbackSpeak(text: string, lang: string): Promise<boolean> {
    if (settingsStore.fallbackToWebSpeech) {
      return await speakWithWebSpeech(text, lang, settingsStore.ttsSpeed)
    }

    return false
  }

  async function speak(
    text: string | null | undefined,
    explicitLanguage?: string,
    explicitBookId?: number,
    forceCacheBypass?: boolean,
  ): Promise<boolean> {
    if (!text)
      return false

    const { bookId, lang, voice } = getTtsParams(explicitLanguage, explicitBookId)

    if (!validateText(text))
      return fallbackSpeak(text, lang)

    abortIfLoading()
    stop()

    isLoading.value = true
    const controller = new AbortController()
    abortController = controller

    try {
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
        return fallbackSpeak(text, lang)

      await playAudioBlob(audioBlob, lang, voice)

      return true
    }
    catch (e) {
      if (isAbortError(e as Error))
        return false

      console.error('TTS Error:', e)

      return fallbackSpeak(text, lang)
    }
    finally {
      if (abortController === controller)
        isLoading.value = false
    }
  }

  function stop() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel()
    }

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
