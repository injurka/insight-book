import { ref } from 'vue'
import { requestTtsAudio } from '../../../shared/lib/api'
import { stripStressMarks } from '../../../shared/lib/russian-utils'

const audioCache = new Map<string, string>()

export function useAnalyzerTts() {
  const isPlaying = ref(false)
  const isLoadingAudio = ref(false)
  const activeText = ref<string | null>(null)
  let currentAudio: HTMLAudioElement | null = null

  function stopAudio(): void {
    if (currentAudio) {
      currentAudio.pause()
      currentAudio.currentTime = 0
      currentAudio = null
    }

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel()
    }

    isPlaying.value = false
    isLoadingAudio.value = false
    activeText.value = null
  }

  function playViaWebSpeech(text: string): boolean {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      return false
    }

    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'ru-RU'
    utterance.rate = 0.92

    utterance.onstart = () => {
      isPlaying.value = true
      activeText.value = text
    }

    utterance.onend = () => {
      isPlaying.value = false
      activeText.value = null
    }

    utterance.onerror = () => {
      isPlaying.value = false
      activeText.value = null
    }

    window.speechSynthesis.speak(utterance)

    return true
  }

  async function playBase64Audio(base64: string, text: string): Promise<boolean> {
    const src = base64.startsWith('data:') ? base64 : `data:audio/mp3;base64,${base64}`
    const audio = new Audio(src)
    currentAudio = audio
    activeText.value = text
    isPlaying.value = true

    audio.onended = () => {
      isPlaying.value = false
      activeText.value = null
      currentAudio = null
    }

    audio.onerror = () => {
      isPlaying.value = false
      activeText.value = null
      currentAudio = null
    }

    try {
      await audio.play()

      return true
    }
    catch {
      return false
    }
  }

  async function speakRussian(text: string): Promise<void> {
    const clean = stripStressMarks(text).trim()

    if (!clean) {
      return
    }

    if (isPlaying.value && activeText.value === clean) {
      stopAudio()

      return
    }

    stopAudio()
    const cached = audioCache.get(clean)

    if (cached) {
      const ok = await playBase64Audio(cached, clean)

      if (ok) {
        return
      }
    }

    isLoadingAudio.value = true
    activeText.value = clean

    try {
      const base64 = await requestTtsAudio(clean)

      if (base64) {
        audioCache.set(clean, base64)
        isLoadingAudio.value = false
        const played = await playBase64Audio(base64, clean)

        if (played) {
          return
        }
      }
    }
    catch {
      // Fallback to browser speech synthesis
    }
    finally {
      isLoadingAudio.value = false
    }

    playViaWebSpeech(clean)
  }

  return {
    isPlaying,
    isLoadingAudio,
    activeText,
    speakRussian,
    stopAudio,
  }
}
