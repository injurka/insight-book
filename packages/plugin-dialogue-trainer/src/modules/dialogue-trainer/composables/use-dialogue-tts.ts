import { onUnmounted, ref } from 'vue'
import { requestTtsAudio } from '../../../shared/lib/api'

export function useDialogueTts() {
  const isPlaying = ref(false)
  const currentPlayingId = ref<string | null>(null)
  const isLoadingAudio = ref(false)

  let currentAudio: HTMLAudioElement | null = null
  let activeEndedCallback: (() => void) | null = null

  function stopAudio() {
    activeEndedCallback = null

    if (currentAudio) {
      try {
        currentAudio.pause()
        currentAudio.currentTime = 0
      }
      catch {}

      currentAudio = null
    }

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel()
    }

    isPlaying.value = false
    currentPlayingId.value = null
    isLoadingAudio.value = false
  }

  function resolveWebSpeechLang(language: string): string {
    const langMap: Record<string, string> = {
      en: 'en-US',
      ru: 'ru-RU',
      zh: 'zh-CN',
    }

    return langMap[language.substring(0, 2)] || 'en-US'
  }

  function playWebSpeech(text: string, language: string, onEnded?: () => void) {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      isPlaying.value = false
      currentPlayingId.value = null
      onEnded?.()

      return
    }

    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = resolveWebSpeechLang(language)
    utterance.rate = 0.95

    utterance.onstart = () => {
      isPlaying.value = true
    }

    utterance.onend = () => {
      isPlaying.value = false
      currentPlayingId.value = null
      onEnded?.()
    }

    utterance.onerror = () => {
      isPlaying.value = false
      currentPlayingId.value = null
      onEnded?.()
    }

    window.speechSynthesis.speak(utterance)
  }

  async function resolveAudioBase64(text: string, voice?: string, cached?: string): Promise<string | null> {
    if (cached) {
      return cached
    }

    try {
      return await requestTtsAudio(text, voice)
    }
    catch {
      return null
    }
  }

  function playAudioElement(base64: string, onEnded?: () => void): HTMLAudioElement {
    const audioUrl = `data:audio/mp3;base64,${base64}`
    const audio = new Audio(audioUrl)

    audio.onplay = () => {
      isPlaying.value = true
    }

    audio.onended = () => {
      isPlaying.value = false
      currentPlayingId.value = null
      currentAudio = null
      onEnded?.()
    }

    return audio
  }

  async function playAudio(
    id: string,
    text: string,
    language: string,
    cachedBase64?: string,
    voice?: string,
    onEnded?: () => void,
  ): Promise<string | null> {
    if (currentPlayingId.value === id && isPlaying.value) {
      stopAudio()

      return cachedBase64 || null
    }

    stopAudio()
    currentPlayingId.value = id
    isLoadingAudio.value = true
    activeEndedCallback = onEnded || null

    const base64 = await resolveAudioBase64(text, voice, cachedBase64)
    isLoadingAudio.value = false

    if (base64) {
      try {
        const audio = playAudioElement(base64, activeEndedCallback || undefined)
        currentAudio = audio

        audio.onerror = () => {
          playWebSpeech(text, language, activeEndedCallback || undefined)
        }

        await audio.play()

        return base64
      }
      catch {
        playWebSpeech(text, language, activeEndedCallback || undefined)

        return null
      }
    }

    playWebSpeech(text, language, activeEndedCallback || undefined)

    return null
  }

  onUnmounted(() => {
    stopAudio()
  })

  return {
    isPlaying,
    currentPlayingId,
    isLoadingAudio,
    playAudio,
    stopAudio,
  }
}
