import { ref } from 'vue'
import { requestCachedTtsAudio, requestTtsAudio } from '../../../shared/lib/api'

export function useAnalyzerTts() {
  // Keep recent results in memory for the current page only.
  const audioCache = new Map<string, string>()
  const isPlaying = ref(false)
  const isLoadingAudio = ref(false)
  const isAudioUnavailable = ref(false)
  const activeText = ref<string | null>(null)
  let currentAudio: HTMLAudioElement | null = null
  let currentSpeech: SpeechSynthesisUtterance | null = null
  let currentRequest: AbortController | null = null
  let noticeTimer: ReturnType<typeof setTimeout> | undefined

  function stopAudio(): void {
    currentRequest?.abort()
    currentRequest = null
    currentAudio?.pause()
    currentAudio = null

    if (currentSpeech) {
      currentSpeech = null
      window.speechSynthesis.cancel()
    }

    clearTimeout(noticeTimer)
    isAudioUnavailable.value = false
    isPlaying.value = false
    isLoadingAudio.value = false
    activeText.value = null
  }

  function showUnavailable(): void {
    stopAudio()
    isAudioUnavailable.value = true
    noticeTimer = setTimeout(() => {
      isAudioUnavailable.value = false
    }, 4500)
  }

  function playLocalSpeech(text: string, signal: AbortSignal): boolean {
    if (typeof window === 'undefined' || !('speechSynthesis' in window))
      return false

    const voice = window.speechSynthesis.getVoices().find(voice =>
      voice.localService && /^(?:cmn(?:-|$)|zh(?:$|-(?:cn|tw|sg|hans|hant)(?:-|$)))/i.test(voice.lang))

    if (!voice)
      return false

    const utterance = new SpeechSynthesisUtterance(text)
    currentSpeech = utterance
    utterance.voice = voice
    utterance.lang = voice.lang
    utterance.rate = 0.92
    utterance.onend = () => {
      if (!signal.aborted) {
        currentSpeech = null
        stopAudio()
      }
    }
    utterance.onerror = () => {
      if (!signal.aborted)
        showUnavailable()
    }

    try {
      window.speechSynthesis.speak(utterance)
      isPlaying.value = true

      return true
    }
    catch {
      currentSpeech = null

      return false
    }
  }

  async function playAudio(base64: string, signal: AbortSignal): Promise<boolean> {
    const audio = new Audio(`data:audio/mpeg;base64,${base64}`)
    currentAudio = audio
    audio.onended = () => {
      if (currentAudio === audio)
        stopAudio()
    }
    audio.onerror = () => {
      if (currentAudio === audio && isPlaying.value)
        showUnavailable()
    }

    try {
      await audio.play()

      if (signal.aborted) {
        audio.pause()

        return false
      }

      isPlaying.value = true

      return true
    }
    catch {
      if (currentAudio === audio)
        currentAudio = null

      return false
    }
  }

  async function loadAudio(text: string, signal: AbortSignal): Promise<string | null> {
    try {
      const cached = audioCache.get(text) ?? await requestCachedTtsAudio(text, signal).catch(() => null)
      signal.throwIfAborted()

      const audio = cached ?? await requestTtsAudio(text, signal)

      if (audio && !signal.aborted) {
        audioCache.delete(text)
        audioCache.set(text, audio)

        if (audioCache.size > 24) {
          const oldest = audioCache.keys().next().value

          if (oldest !== undefined)
            audioCache.delete(oldest)
        }
      }

      return audio
    }
    catch {
      return null
    }
  }

  async function speakChinese(text: string): Promise<void> {
    const clean = text.trim()

    if (!clean)
      return

    const wasActive = activeText.value === clean
    stopAudio()

    if (wasActive)
      return

    currentRequest = new AbortController()
    const { signal } = currentRequest
    activeText.value = clean
    isLoadingAudio.value = true

    const audio = await loadAudio(clean, signal)

    if (signal.aborted)
      return

    const played = audio ? await playAudio(audio, signal) : false

    if (signal.aborted)
      return

    isLoadingAudio.value = false

    if (!played && !playLocalSpeech(clean, signal))
      showUnavailable()
  }

  return {
    activeText,
    isPlaying,
    isLoadingAudio,
    isAudioUnavailable,
    speakChinese,
    stopAudio,
  }
}
