type UiSound = 'select' | 'place' | 'remove'

const soundPresets: Record<UiSound, { from: number, to: number, duration: number, volume: number }> = {
  select: { from: 720, to: 960, duration: 0.1, volume: 0.035 },
  place: { from: 490, to: 740, duration: 0.16, volume: 0.045 },
  remove: { from: 460, to: 280, duration: 0.13, volume: 0.035 },
}

let audioContext: AudioContext | undefined

export function playUiSound(sound: UiSound) {
  if (typeof window === 'undefined' || !window.AudioContext)
    return

  audioContext ??= new window.AudioContext()
  if (audioContext.state === 'suspended')
    void audioContext.resume().catch(() => {})

  const preset = soundPresets[sound]
  const startAt = audioContext.currentTime
  const oscillator = audioContext.createOscillator()
  const gain = audioContext.createGain()

  oscillator.type = 'sine'
  oscillator.frequency.setValueAtTime(preset.from, startAt)
  oscillator.frequency.exponentialRampToValueAtTime(preset.to, startAt + preset.duration)
  gain.gain.setValueAtTime(0.0001, startAt)
  gain.gain.exponentialRampToValueAtTime(preset.volume, startAt + 0.012)
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + preset.duration)

  oscillator.connect(gain)
  gain.connect(audioContext.destination)
  oscillator.start(startAt)
  oscillator.stop(startAt + preset.duration + 0.01)
}
