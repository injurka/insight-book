import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const generateTtsMock = vi.fn()
const getLocalTtsMock = vi.fn()
const saveLocalTtsMock = vi.fn()

vi.mock('~/05.modules/reader/store/reader.store', () => ({
  useReaderStore: () => ({
    currentBook: { id: 1, language: 'en' },
  }),
}))

vi.mock('~/00.plugins/di', () => ({
  useRepos: () => ({
    analysis: {
      generateTts: generateTtsMock,
      generateGenericTts: vi.fn(),
      getLocalTts: getLocalTtsMock,
      saveLocalTts: saveLocalTtsMock,
    },
  }),
}))

vi.mock('~/01.shared/composables/use-tracking', () => ({
  useTracking: () => ({
    trackEvent: vi.fn(),
  }),
}))

// Mock HTMLAudioElement
class MockAudio {
  playbackRate = 1
  onplay: (() => void) | null = null
  onended: (() => void) | null = null
  play = vi.fn().mockImplementation(() => {
    if (this.onplay) {
      this.onplay()
    }

    return Promise.resolve()
  })

  pause = vi.fn()
}

globalThis.Audio = MockAudio as unknown as typeof Audio
globalThis.URL.createObjectURL = vi.fn().mockReturnValue('blob:mock-audio')
globalThis.URL.revokeObjectURL = vi.fn()

const { useTts } = await import('./use-tts')

describe('useTts composable', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    getLocalTtsMock.mockResolvedValue(new Blob(['fake audio'], { type: 'audio/mp3' }))
  })

  it('updates currentText and isPlaying when speak is called', async () => {
    const tts = useTts()
    const sentence = 'For Ganoes, the ancient fortification overlooking the city was too familiar.'

    const started = await tts.speak(sentence)

    expect(started).toBe(true)
    expect(tts.isPlaying.value).toBe(true)
    expect(tts.currentText.value).toBe(sentence)
  })

  it('does not stop playback when stop(targetText) is called with a mismatched text', async () => {
    const tts = useTts()
    const sentence = 'For Ganoes, the ancient fortification overlooking the city was too familiar.'

    await tts.speak(sentence)
    expect(tts.isPlaying.value).toBe(true)

    // A popover for word 'familiar' is closed and calls stop('familiar')
    tts.stop('familiar')

    // The sentence audio should NOT be stopped
    expect(tts.isPlaying.value).toBe(true)
    expect(tts.currentText.value).toBe(sentence)
  })

  it('stops playback when stop(targetText) is called with the matching text', async () => {
    const tts = useTts()
    const word = 'familiar'

    await tts.speak(word)
    expect(tts.isPlaying.value).toBe(true)
    expect(tts.currentText.value).toBe(word)

    tts.stop('familiar')

    expect(tts.isPlaying.value).toBe(false)
    expect(tts.currentText.value).toBeNull()
  })

  it('stops playback unconditionally when stop() is called without arguments', async () => {
    const tts = useTts()
    const sentence = 'For Ganoes, the ancient fortification overlooking the city was too familiar.'

    await tts.speak(sentence)
    expect(tts.isPlaying.value).toBe(true)

    tts.stop()

    expect(tts.isPlaying.value).toBe(false)
    expect(tts.currentText.value).toBeNull()
  })
})
