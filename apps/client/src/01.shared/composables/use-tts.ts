import { isTtsTextWithinLimit } from '@injurka/insight-book-language-utils'
import { hasInjectionContext, inject, ref } from 'vue'
import { useRepos } from '~/00.plugins/di'
import { useTracking } from '~/01.shared/composables/use-tracking'
import { buildBookTtsCacheKey, buildDictionaryTtsCacheKey, DEFAULT_TTS_VOICE } from '~/01.shared/constants/tts'
import { useGlobalSettingsStore } from '~/01.shared/store/settings.store'
import { TTS_BOOK_CONTEXT_KEY } from '~/01.shared/types/tts-context'

const isPlaying = ref(false)
const isLoading = ref(false)
const currentText = ref<string | null>(null)

let currentAudio: HTMLAudioElement | null = null
let currentAudioUrl: string | null = null
let abortController: AbortController | null = null
let playbackId = 0
let cancelWebSpeech: (() => void) | null = null

export function useTts() {
  const repos = useRepos()
  const { trackEvent } = useTracking()

  const getBook = hasInjectionContext() ? inject(TTS_BOOK_CONTEXT_KEY, () => null) : () => null
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
    const cacheKey = bookId
      ? buildBookTtsCacheKey(bookId, voice, normalizedText)
      : buildDictionaryTtsCacheKey(lang, voice, normalizedText)
    let audioBlob = forceCacheBypass ? null : await repos.analysis.getLocalTts(cacheKey)

    signal.throwIfAborted()

    if (!audioBlob) {
      const result = bookId
        ? await repos.analysis.generateTts(
            bookId,
            text,
            voice,
            signal,
            forceCacheBypass,
          )
        : await repos.analysis.generateGenericTts(
            text,
            voice,
            signal,
            forceCacheBypass,
          )
      signal.throwIfAborted()
      await repos.analysis.saveLocalTts(cacheKey, result.audioBase64, result.cache)
      audioBlob = await repos.analysis.getLocalTts(cacheKey)
    }

    return audioBlob
  }

  function isAbortError(error: unknown) {
    return error instanceof Error && ['AbortError', 'CanceledError'].includes(error.name)
  }

  async function playAudioBlob(
    audioBlob: Blob,
    lang: string,
    voice: string,
    text: string,
  ) {
    currentAudioUrl = URL.createObjectURL(audioBlob)
    const audio = new Audio(currentAudioUrl)
    const audioUrl = currentAudioUrl
    currentAudio = audio
    audio.playbackRate = settingsStore.ttsSpeed

    audio.onplay = () => {
      if (currentAudio === audio)
        isPlaying.value = true
    }
    audio.onended = () => {
      if (currentAudio !== audio)
        return

      currentAudio = null
      isPlaying.value = false

      if (currentText.value === text) {
        currentText.value = null
      }

      URL.revokeObjectURL(audioUrl)
      currentAudioUrl = null
    }

    trackEvent('tts_played', { lang, voice })
    await audio.play()
  }

  function validateText(text: string): boolean {
    return isTtsTextWithinLimit(text)
  }

  function getTtsParams(explicitLanguage?: string, explicitBookId?: number) {
    const book = getBook()
    const bookId = explicitBookId ?? book?.id
    const lang = explicitLanguage || book?.language || 'en'
    const voice = settingsStore.ttsVoice || DEFAULT_TTS_VOICE

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
    const id = playbackId

    return new Promise((resolve) => {
      const finish = (result: boolean) => {
        if (playbackId === id) {
          isPlaying.value = false
          clearCurrentTextIfMatches(text)
          cancelWebSpeech = null
        }

        resolve(result)
      }
      cancelWebSpeech = () => finish(false)

      if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
        finish(false)

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
          if (playbackId === id)
            isPlaying.value = true
        }

        utterance.onend = () => finish(true)

        utterance.onerror = (e) => {
          if (e.error !== 'interrupted' && e.error !== 'canceled') {
            console.warn('[Web Speech TTS Error]', e)
          }

          finish(false)
        }

        isPlaying.value = true
        window.speechSynthesis.speak(utterance)
      }
      catch (err) {
        console.warn('[Web Speech TTS Exception]', err)
        finish(false)
      }
    })
  }

  async function fallbackSpeak(text: string, lang: string): Promise<boolean> {
    if (settingsStore.fallbackToWebSpeech) {
      abortIfLoading()
      stop()
      currentText.value = text
      const id = playbackId
      const result = await speakWithWebSpeech(text, lang, settingsStore.ttsSpeed)

      if (!result && playbackId === id) {
        currentText.value = null
      }

      return result
    }

    return false
  }

  function isStale(controller: AbortController, id: number) {
    return controller.signal.aborted || playbackId !== id
  }

  function matchesTarget(targetText?: string) {
    if (targetText === undefined)
      return true

    return currentText.value?.trim() === targetText.trim()
  }

  function clearCurrentTextIfMatches(text: string) {
    if (currentText.value === text) {
      currentText.value = null
    }
  }

  async function handleSpeakFallback(text: string, lang: string): Promise<boolean> {
    const id = playbackId
    const res = await fallbackSpeak(text, lang)

    if (!res && playbackId === id) {
      clearCurrentTextIfMatches(text)
    }

    return res
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

    currentText.value = text
    isLoading.value = true
    const controller = new AbortController()
    const id = playbackId
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

      if (isStale(controller, id))
        return false

      if (!audioBlob) {
        stop()

        return handleSpeakFallback(text, lang)
      }

      await playAudioBlob(
        audioBlob,
        lang,
        voice,
        text,
      )

      return playbackId === id
    }
    catch (e) {
      if (isStale(controller, id) || isAbortError(e)) {
        if (playbackId === id)
          clearCurrentTextIfMatches(text)

        return false
      }

      console.error('TTS Error:', e)
      stop()

      return handleSpeakFallback(text, lang)
    }
    finally {
      if (abortController === controller) {
        isLoading.value = false
        abortController = null
      }
    }
  }

  function stop(targetText?: string) {
    if (!matchesTarget(targetText))
      return

    cancelWebSpeech?.()
    cancelWebSpeech = null
    playbackId++

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
    currentText.value = null
  }

  return {
    speak,
    stop,
    isPlaying,
    isLoading,
    currentText,
  }
}
