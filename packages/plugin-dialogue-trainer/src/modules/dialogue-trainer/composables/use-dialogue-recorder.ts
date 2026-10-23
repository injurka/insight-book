import { onUnmounted, ref } from 'vue'
import { requestSpeechToText } from '../../../shared/lib/api'

const DEFAULT_SILENCE_TIMEOUT_MS = 1600
const SPEECH_VOLUME_THRESHOLD = 14

interface VadState {
  speechDetected: boolean
  silenceStartTime: number
  framesAboveThreshold: number
}

function computeAverageVolume(analyser: AnalyserNode, buffer: Uint8Array): number {
  analyser.getByteFrequencyData(buffer)
  let sum = 0

  for (let i = 0; i < buffer.length; i++) {
    sum += buffer[i]
  }

  return sum / buffer.length
}

function processVadSpeech(avgVolume: number, state: VadState): void {
  if (avgVolume > SPEECH_VOLUME_THRESHOLD) {
    state.framesAboveThreshold++

    if (state.framesAboveThreshold > 3) {
      state.speechDetected = true
    }

    state.silenceStartTime = 0
  }
}

function shouldTriggerSilence(
  state: VadState,
  now: number,
  duration: number,
  timeoutMs: number,
): boolean {
  if (!state.speechDetected || duration < 1) {
    return false
  }

  if (state.silenceStartTime === 0) {
    state.silenceStartTime = now

    return false
  }

  return now - state.silenceStartTime >= timeoutMs
}

export function useDialogueRecorder() {
  const isRecording = ref(false)
  const isTranscribing = ref(false)
  const recordingDuration = ref(0)
  const currentAudioLevel = ref(0)
  const errorMessage = ref<string | null>(null)

  let mediaRecorder: MediaRecorder | null = null
  let audioChunks: Blob[] = []
  let timerInterval: ReturnType<typeof setInterval> | null = null
  let mediaStream: MediaStream | null = null
  let audioContext: AudioContext | null = null
  let analyserNode: AnalyserNode | null = null
  let vadRafId: number | null = null

  function startTimer() {
    recordingDuration.value = 0
    timerInterval = setInterval(() => {
      recordingDuration.value++
    }, 1000)
  }

  function stopTimer() {
    if (timerInterval) {
      clearInterval(timerInterval)
      timerInterval = null
    }
  }

  function getSupportedMimeType(): string {
    const types = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4',
      'audio/ogg;codecs=opus',
      'audio/wav',
    ]

    for (const t of types) {
      if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(t)) {
        return t
      }
    }

    return ''
  }

  function stopVad() {
    if (vadRafId) {
      cancelAnimationFrame(vadRafId)
      vadRafId = null
    }

    if (audioContext) {
      try {
        audioContext.close()
      }
      catch {}

      audioContext = null
    }

    analyserNode = null
    currentAudioLevel.value = 0
  }

  function startVad(stream: MediaStream, onSilence?: () => void, silenceTimeoutMs = DEFAULT_SILENCE_TIMEOUT_MS) {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext

      if (!AudioCtx) {
        return
      }

      audioContext = new AudioCtx()

      if (audioContext.state === 'suspended') {
        audioContext.resume()
      }

      const source = audioContext.createMediaStreamSource(stream)
      analyserNode = audioContext.createAnalyser()
      analyserNode.fftSize = 256
      analyserNode.smoothingTimeConstant = 0.3
      source.connect(analyserNode)

      const bufferLength = analyserNode.frequencyBinCount
      const dataArray = new Uint8Array(bufferLength)

      const vadState: VadState = {
        speechDetected: false,
        silenceStartTime: 0,
        framesAboveThreshold: 0,
      }

      const checkVad = () => {
        if (!isRecording.value || !analyserNode) {
          return
        }

        const avgVolume = computeAverageVolume(analyserNode, dataArray)
        currentAudioLevel.value = Math.min(100, Math.round(avgVolume * 2.2))

        processVadSpeech(avgVolume, vadState)

        const now = performance.now()
        const isSilent = avgVolume <= SPEECH_VOLUME_THRESHOLD

        if (isSilent && shouldTriggerSilence(
          vadState,
          now,
          recordingDuration.value,
          silenceTimeoutMs,
        )) {
          stopVad()
          onSilence?.()

          return
        }

        vadRafId = requestAnimationFrame(checkVad)
      }

      vadRafId = requestAnimationFrame(checkVad)
    }
    catch (err) {
      console.warn('[DialogueRecorder] Failed to start VAD audio analyser:', err)
    }
  }

  async function startRecording(onSilence?: () => void, silenceTimeoutMs?: number): Promise<boolean> {
    errorMessage.value = null
    audioChunks = []

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      errorMessage.value = 'micNotFound'

      return false
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      })
      mediaStream = stream

      const mimeType = getSupportedMimeType()
      const options: MediaRecorderOptions = mimeType ? { mimeType } : {}

      mediaRecorder = new MediaRecorder(stream, options)
      audioChunks = []

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunks.push(event.data)
        }
      }

      mediaRecorder.start(250)
      isRecording.value = true
      startTimer()
      startVad(stream, onSilence, silenceTimeoutMs)

      return true
    }
    catch (err: unknown) {
      const error = err as Error
      console.warn('[DialogueRecorder] Failed to start recording:', error)
      errorMessage.value = error?.name === 'NotAllowedError' ? 'micPermissionDenied' : 'micNotFound'
      isRecording.value = false

      return false
    }
  }

  async function processRecordedAudio(blob: Blob, language?: string): Promise<string | null> {
    if (blob.size < 100) {
      return null
    }

    isTranscribing.value = true

    try {
      return await requestSpeechToText(blob, language)
    }
    catch (err) {
      console.warn('[DialogueRecorder] Speech-to-text transcription error:', err)
      errorMessage.value = 'transcriptionFailed'

      return null
    }
    finally {
      isTranscribing.value = false
    }
  }

  async function stopRecording(language?: string): Promise<string | null> {
    stopTimer()
    stopVad()

    if (!mediaRecorder || !isRecording.value) {
      isRecording.value = false

      return null
    }

    isRecording.value = false

    return new Promise((resolve) => {
      mediaRecorder!.onstop = async () => {
        if (mediaStream) {
          mediaStream.getTracks().forEach(track => track.stop())
          mediaStream = null
        }

        const mimeType = mediaRecorder?.mimeType || 'audio/webm'
        const audioBlob = new Blob(audioChunks, { type: mimeType })
        audioChunks = []

        const text = await processRecordedAudio(audioBlob, language)
        resolve(text)
      }

      try {
        mediaRecorder!.stop()
      }
      catch {
        isTranscribing.value = false
        resolve(null)
      }
    })
  }

  function cancelRecording() {
    stopTimer()
    stopVad()
    isRecording.value = false
    isTranscribing.value = false

    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      try {
        mediaRecorder.stop()
      }
      catch {}
    }

    if (mediaStream) {
      mediaStream.getTracks().forEach(track => track.stop())
      mediaStream = null
    }

    audioChunks = []
  }

  onUnmounted(() => {
    cancelRecording()
  })

  return {
    isRecording,
    isTranscribing,
    recordingDuration,
    currentAudioLevel,
    errorMessage,
    startRecording,
    stopRecording,
    cancelRecording,
  }
}
