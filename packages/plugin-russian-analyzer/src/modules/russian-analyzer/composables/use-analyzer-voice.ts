import { onUnmounted, ref } from 'vue'
import { requestSpeechToText } from '../../../shared/lib/api'

export type VoiceErrorKey = 'voiceErrorMicPermission' | 'voiceErrorMicNotFound' | 'voiceErrorTranscribe'

const SILENCE_TIMEOUT_MS = 1900
const SPEECH_VOLUME_THRESHOLD = 14
const MAX_RECORDING_SEC = 60

interface VadTracker {
  speechDetected: boolean
  silenceStart: number
  loudFrames: number
}

function getAverageFrequencyVolume(analyser: AnalyserNode, buffer: Uint8Array<ArrayBuffer>): number {
  analyser.getByteFrequencyData(buffer)
  let total = 0

  for (let i = 0; i < buffer.length; i++) {
    total += buffer[i]
  }

  return total / buffer.length
}

function updateVadTracker(volume: number, tracker: VadTracker): void {
  if (volume > SPEECH_VOLUME_THRESHOLD) {
    tracker.loudFrames++

    if (tracker.loudFrames > 3) {
      tracker.speechDetected = true
    }

    tracker.silenceStart = 0
  }
}

function isSilenceReached(tracker: VadTracker, now: number, durationSec: number): boolean {
  if (!tracker.speechDetected || durationSec < 1) {
    return false
  }

  if (tracker.silenceStart === 0) {
    tracker.silenceStart = now

    return false
  }

  return now - tracker.silenceStart >= SILENCE_TIMEOUT_MS
}

function pickSupportedAudioMime(): string {
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/ogg;codecs=opus',
    'audio/wav',
  ]

  for (const mime of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(mime)) {
      return mime
    }
  }

  return ''
}

export function useAnalyzerVoice() {
  const isRecording = ref(false)
  const isTranscribing = ref(false)
  const recordingDuration = ref(0)
  const audioLevel = ref(0)
  const voiceErrorKey = ref<VoiceErrorKey | null>(null)

  let mediaRecorder: MediaRecorder | null = null
  let mediaStream: MediaStream | null = null
  let audioChunks: Blob[] = []
  let timerId: ReturnType<typeof setInterval> | null = null
  let audioCtx: AudioContext | null = null
  let analyserNode: AnalyserNode | null = null
  let rafId: number | null = null

  function clearTimer(): void {
    if (timerId) {
      clearInterval(timerId)
      timerId = null
    }
  }

  function stopAudioAnalyser(): void {
    if (rafId) {
      cancelAnimationFrame(rafId)
      rafId = null
    }

    if (audioCtx) {
      void audioCtx.close().catch(() => {})
      audioCtx = null
    }

    analyserNode = null
    audioLevel.value = 0
  }

  function stopStreamTracks(): void {
    if (mediaStream) {
      mediaStream.getTracks().forEach(track => track.stop())
      mediaStream = null
    }
  }

  function startDurationTimer(onMaxReached?: () => void): void {
    recordingDuration.value = 0
    clearTimer()

    timerId = setInterval(() => {
      recordingDuration.value++

      if (recordingDuration.value >= MAX_RECORDING_SEC) {
        clearTimer()
        stopAudioAnalyser()
        onMaxReached?.()
      }
    }, 1000)
  }

  function attachVadAnalyser(stream: MediaStream, onSilenceStop?: () => void): void {
    try {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext

      if (!Ctx) {
        return
      }

      audioCtx = new Ctx()
      const source = audioCtx.createMediaStreamSource(stream)
      analyserNode = audioCtx.createAnalyser()
      analyserNode.fftSize = 256
      analyserNode.smoothingTimeConstant = 0.3
      source.connect(analyserNode)

      const dataBuffer = new Uint8Array(new ArrayBuffer(analyserNode.frequencyBinCount))
      const tracker: VadTracker = {
        speechDetected: false,
        silenceStart: 0,
        loudFrames: 0,
      }

      const tick = (): void => {
        if (!isRecording.value || !analyserNode) {
          return
        }

        const avg = getAverageFrequencyVolume(analyserNode, dataBuffer)
        audioLevel.value = Math.min(100, Math.round(avg * 2.2))
        updateVadTracker(avg, tracker)

        if (avg <= SPEECH_VOLUME_THRESHOLD && isSilenceReached(tracker, performance.now(), recordingDuration.value)) {
          stopAudioAnalyser()
          onSilenceStop?.()

          return
        }

        rafId = requestAnimationFrame(tick)
      }

      rafId = requestAnimationFrame(tick)
    }
    catch {
      // VAD visualization is non-critical
    }
  }

  async function startRecording(onAutoSilenceStop?: () => void): Promise<boolean> {
    voiceErrorKey.value = null
    audioChunks = []

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      voiceErrorKey.value = 'voiceErrorMicNotFound'

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

      const mimeType = pickSupportedAudioMime()
      mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : {})

      mediaRecorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) {
          audioChunks.push(ev.data)
        }
      }

      mediaRecorder.start(250)
      isRecording.value = true
      startDurationTimer(onAutoSilenceStop)
      attachVadAnalyser(stream, onAutoSilenceStop)

      return true
    }
    catch (err: unknown) {
      const error = err as Error
      voiceErrorKey.value = error?.name === 'NotAllowedError' ? 'voiceErrorMicPermission' : 'voiceErrorMicNotFound'
      isRecording.value = false

      return false
    }
  }

  async function transcribeBlob(blob: Blob): Promise<string | null> {
    if (blob.size < 100) {
      return null
    }

    isTranscribing.value = true

    try {
      const text = await requestSpeechToText(blob)

      if (!text) {
        voiceErrorKey.value = 'voiceErrorTranscribe'

        return null
      }

      return text
    }
    catch {
      voiceErrorKey.value = 'voiceErrorTranscribe'

      return null
    }
    finally {
      isTranscribing.value = false
    }
  }

  async function stopRecording(): Promise<string | null> {
    clearTimer()
    stopAudioAnalyser()

    if (!mediaRecorder || !isRecording.value) {
      isRecording.value = false

      return null
    }

    isRecording.value = false

    return new Promise((resolve) => {
      mediaRecorder!.onstop = async () => {
        stopStreamTracks()
        const mimeType = mediaRecorder?.mimeType || 'audio/webm'
        const blob = new Blob(audioChunks, { type: mimeType })
        audioChunks = []
        const recognized = await transcribeBlob(blob)
        resolve(recognized)
      }

      try {
        mediaRecorder!.stop()
      }
      catch {
        stopStreamTracks()
        isTranscribing.value = false
        resolve(null)
      }
    })
  }

  function cancelRecording(): void {
    clearTimer()
    stopAudioAnalyser()
    isRecording.value = false
    isTranscribing.value = false

    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      try {
        mediaRecorder.stop()
      }
      catch {}
    }

    stopStreamTracks()
    audioChunks = []
  }

  onUnmounted(() => {
    cancelRecording()
  })

  return {
    isRecording,
    isTranscribing,
    recordingDuration,
    audioLevel,
    voiceErrorKey,
    startRecording,
    stopRecording,
    cancelRecording,
  }
}
