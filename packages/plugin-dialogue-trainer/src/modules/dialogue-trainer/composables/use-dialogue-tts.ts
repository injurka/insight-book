import { getCurrentInstance, onUnmounted, ref } from 'vue'
import { requestTtsAudio } from '../../../shared/lib/api'

const VOLUME_STORAGE_KEY = 'dialogue_trainer_volume'

function getInitialVolume(): number {
  if (typeof window === 'undefined') {
    return 1
  }

  try {
    const saved = localStorage.getItem(VOLUME_STORAGE_KEY)

    if (saved !== null) {
      const parsed = Number.parseFloat(saved)

      if (!Number.isNaN(parsed) && parsed >= 0 && parsed <= 1) {
        return parsed
      }
    }
  }
  catch {}

  return 1
}

const sharedVolume = ref(getInitialVolume())

export function useDialogueTts() {
  const isPlaying = ref(false)
  const currentPlayingId = ref<string | null>(null)
  const currentPlayingMessageId = ref<string | null>(null)
  const currentPlayingSentenceIdx = ref<number | null>(null)
  const loadingSentenceKey = ref<string | null>(null)
  const isLoadingAudio = ref(false)

  let currentAudio: HTMLAudioElement | null = null
  let activeEndedCallback: (() => void) | null = null
  let isSequentialRunning = false
  let sequentialToken = 0

  function stopCurrentAudio() {
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
    isLoadingAudio.value = false
    loadingSentenceKey.value = null
  }

  function stopAudio() {
    isSequentialRunning = false
    sequentialToken++
    stopCurrentAudio()
    currentPlayingId.value = null
    currentPlayingMessageId.value = null
    currentPlayingSentenceIdx.value = null
  }

  function isSentencePlaying(msgId: string, idx: number): boolean {
    return isPlaying.value
      && currentPlayingMessageId.value === msgId
      && currentPlayingSentenceIdx.value === idx
  }

  function isSentenceLoading(msgId: string, idx: number): boolean {
    return loadingSentenceKey.value === `${msgId}_${idx}`
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
      currentPlayingMessageId.value = null
      currentPlayingSentenceIdx.value = null
      onEnded?.()

      return
    }

    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = resolveWebSpeechLang(language)
    utterance.rate = 0.95
    utterance.volume = sharedVolume.value

    utterance.onstart = () => {
      isPlaying.value = true
    }

    utterance.onend = () => {
      isPlaying.value = false
      currentPlayingId.value = null
      currentPlayingMessageId.value = null
      currentPlayingSentenceIdx.value = null
      onEnded?.()
    }

    utterance.onerror = () => {
      isPlaying.value = false
      currentPlayingId.value = null
      currentPlayingMessageId.value = null
      currentPlayingSentenceIdx.value = null
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
    audio.volume = sharedVolume.value

    audio.onplay = () => {
      isPlaying.value = true
    }

    audio.onended = () => {
      isPlaying.value = false
      currentPlayingId.value = null
      currentPlayingMessageId.value = null
      currentPlayingSentenceIdx.value = null
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

  function handleSentencePlayState(msgId: string, sentenceIdx: number, isSequential: boolean): boolean {
    if (!isSequential) {
      if (isSentencePlaying(msgId, sentenceIdx)) {
        stopAudio()

        return false
      }

      stopAudio()
    }
    else {
      stopCurrentAudio()
    }

    return true
  }

  async function executeAudioPlay(
    base64: string | null,
    text: string,
    language: string,
    onEnded?: () => void,
  ): Promise<string | null> {
    if (!base64) {
      playWebSpeech(text, language, onEnded)

      return null
    }

    try {
      const audio = playAudioElement(base64, () => onEnded?.())
      currentAudio = audio
      audio.onerror = () => playWebSpeech(text, language, onEnded)
      await audio.play()

      return base64
    }
    catch {
      playWebSpeech(text, language, onEnded)

      return null
    }
  }

  async function playSentence(
    msgId: string,
    sentenceIdx: number,
    text: string,
    language: string,
    cachedBase64?: string,
    onAudioFetched?: (audio: string) => void,
    onEnded?: () => void,
    isSequential = false,
  ): Promise<string | null> {
    if (!handleSentencePlayState(msgId, sentenceIdx, isSequential)) {
      return cachedBase64 || null
    }

    const playId = `${msgId}_sent_${sentenceIdx}`
    currentPlayingId.value = playId
    currentPlayingMessageId.value = msgId
    currentPlayingSentenceIdx.value = sentenceIdx

    let base64 = cachedBase64 || null

    if (!base64) {
      loadingSentenceKey.value = `${msgId}_${sentenceIdx}`
      base64 = await resolveAudioBase64(text)
      loadingSentenceKey.value = null

      if (base64 && onAudioFetched) {
        onAudioFetched(base64)
      }
    }

    if (currentPlayingId.value !== playId) {
      return base64
    }

    return executeAudioPlay(
      base64,
      text,
      language,
      onEnded,
    )
  }

  async function playSentencesSequential(
    msgId: string,
    sentences: string[],
    language: string,
    cachedAudios?: Record<number, string>,
    onAudioFetched?: (idx: number, audio: string) => void,
    onEnded?: () => void,
  ): Promise<void> {
    stopAudio()

    if (!sentences.length) {
      onEnded?.()

      return
    }

    isSequentialRunning = true
    const currentSeqToken = ++sequentialToken

    let index = 0

    const playNext = async () => {
      if (!isSequentialRunning || currentSeqToken !== sequentialToken) {
        return
      }

      if (index >= sentences.length) {
        stopAudio()
        onEnded?.()

        return
      }

      const text = sentences[index]
      const currentIdx = index
      const cached = cachedAudios?.[currentIdx]

      await playSentence(
        msgId,
        currentIdx,
        text,
        language,
        cached,
        (fetchedAudio) => {
          onAudioFetched?.(currentIdx, fetchedAudio)
        },
        () => {
          if (isSequentialRunning && currentSeqToken === sequentialToken) {
            index++
            void playNext()
          }
        },
        true,
      )
    }

    await playNext()
  }

  function setVolume(val: number) {
    const clamped = Math.max(0, Math.min(1, Number.isFinite(val) ? val : 1))
    sharedVolume.value = clamped

    if (currentAudio) {
      try {
        currentAudio.volume = clamped
      }
      catch {}
    }

    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(VOLUME_STORAGE_KEY, String(clamped))
      }
      catch {}
    }
  }

  if (getCurrentInstance()) {
    onUnmounted(() => {
      stopAudio()
    })
  }

  return {
    volume: sharedVolume,
    setVolume,
    isPlaying,
    currentPlayingId,
    currentPlayingMessageId,
    currentPlayingSentenceIdx,
    isLoadingAudio,
    loadingSentenceKey,
    isSentencePlaying,
    isSentenceLoading,
    playAudio,
    playSentence,
    playSentencesSequential,
    stopAudio,
  }
}
