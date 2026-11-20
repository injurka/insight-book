import { describe, expect, it } from 'bun:test'
import { useDialogueTts } from './use-dialogue-tts'

describe('useDialogueTts', () => {
  it('initializes with default idle state', () => {
    const tts = useDialogueTts()

    expect(tts.isPlaying.value).toBe(false)
    expect(tts.currentPlayingId.value).toBeNull()
    expect(tts.currentPlayingMessageId.value).toBeNull()
    expect(tts.currentPlayingSentenceIdx.value).toBeNull()
    expect(tts.isSentencePlaying('msg_1', 0)).toBe(false)
    expect(tts.isSentenceLoading('msg_1', 0)).toBe(false)
  })

  it('stops cleanly and resets states', () => {
    const tts = useDialogueTts()
    tts.stopAudio()

    expect(tts.isPlaying.value).toBe(false)
    expect(tts.currentPlayingId.value).toBeNull()
    expect(tts.currentPlayingMessageId.value).toBeNull()
    expect(tts.currentPlayingSentenceIdx.value).toBeNull()
  })

  it('plays all 4 sentences sequentially to completion', async () => {
    const tts = useDialogueTts()
    const sentences = ['Sentence one.', 'Sentence two.', 'Sentence three.', 'Sentence four.']
    const cached: Record<number, string> = {
      0: 'b64_0',
      1: 'b64_1',
      2: 'b64_2',
      3: 'b64_3',
    }
    const playedSentences: number[] = []

    const originalAudio = (globalThis as unknown as { Audio?: unknown }).Audio
    ;(globalThis as unknown as { Audio: unknown }).Audio = class {
      onplay: (() => void) | null = null
      onended: (() => void) | null = null

      play() {
        this.onplay?.()

        if (tts.currentPlayingSentenceIdx.value !== null) {
          playedSentences.push(tts.currentPlayingSentenceIdx.value)
        }

        setTimeout(() => {
          this.onended?.()
        }, 10)

        return Promise.resolve()
      }

      pause() {}
    }

    try {
      await new Promise<void>((resolve) => {
        tts.playSentencesSequential(
          'msg_test',
          sentences,
          'en',
          cached,
          undefined,
          () => resolve(),
        )
      })

      expect(playedSentences).toEqual([0, 1, 2, 3])
      expect(tts.isPlaying.value).toBe(false)
      expect(tts.currentPlayingMessageId.value).toBeNull()
    }
    finally {
      ;(globalThis as unknown as { Audio: unknown }).Audio = originalAudio
    }
  })

  it('manages and clamps volume properly', () => {
    const tts = useDialogueTts()

    tts.setVolume(0.7)
    expect(tts.volume.value).toBe(0.7)

    tts.setVolume(1.5)
    expect(tts.volume.value).toBe(1)

    tts.setVolume(-0.2)
    expect(tts.volume.value).toBe(0)

    tts.setVolume(0.85)
    expect(tts.volume.value).toBe(0.85)
  })

  it('applies volume and playback speed to Audio instance when playing', async () => {
    const tts = useDialogueTts()
    tts.setVolume(0.42)
    tts.setSpeed(1.25)

    let createdAudioVolume: number | null = null
    let createdAudioRate: number | null = null
    const originalAudio = (globalThis as unknown as { Audio?: unknown }).Audio
    ;(globalThis as unknown as { Audio: unknown }).Audio = class {
      volume = 1
      playbackRate = 1
      onplay: (() => void) | null = null
      onended: (() => void) | null = null

      play() {
        createdAudioVolume = this.volume
        createdAudioRate = this.playbackRate
        this.onplay?.()

        return Promise.resolve()
      }

      pause() {}
    }

    try {
      await tts.playAudio(
        'test_msg',
        'Hello',
        'en',
        'fake_base64',
      )
      expect(createdAudioVolume).toBe(0.42)
      expect(createdAudioRate).toBe(1.25)
      tts.stopAudio()
    }
    finally {
      ;(globalThis as unknown as { Audio: unknown }).Audio = originalAudio
    }
  })

  it('manages and clamps speed properly', () => {
    const tts = useDialogueTts()

    tts.setSpeed(0.75)
    expect(tts.speed.value).toBe(0.75)

    tts.setSpeed(2.5)
    expect(tts.speed.value).toBe(2)

    tts.setSpeed(0.2)
    expect(tts.speed.value).toBe(0.5)

    tts.setSpeed(1)
    expect(tts.speed.value).toBe(1)
  })
})
