import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, provide } from 'vue'
import { useGlobalSettingsStore } from '../store/settings.store'
import { TTS_BOOK_CONTEXT_KEY } from '../types/tts-context'
import { deferred } from './__tests__/helpers'

const generateTtsMock = vi.fn()
const generateGenericTtsMock = vi.fn()
const getLocalTtsMock = vi.fn()
const saveLocalTtsMock = vi.fn()

vi.mock('~/00.plugins/di', () => ({
  useRepos: () => ({
    analysis: {
      generateTts: generateTtsMock,
      generateGenericTts: generateGenericTtsMock,
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
  static instances: MockAudio[] = []
  constructor() { MockAudio.instances.push(this) }
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

const { useTts } = await import('./use-tts')

describe('useTts composable', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.resetAllMocks()
    MockAudio.instances = []
    vi.stubGlobal('Audio', MockAudio)
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-audio')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    getLocalTtsMock.mockResolvedValue(new Blob(['fake audio'], { type: 'audio/mp3' }))
  })

  afterEach(() => {
    useTts().stop()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('updates currentText and isPlaying when speak is called', async () => {
    const tts = useTts()
    const sentence = 'For Ganoes, the ancient fortification overlooking the city was too familiar.'

    const started = await tts.speak(sentence)

    expect(started).toBe(true)
    expect(tts.isPlaying.value).toBe(true)
    expect(tts.currentText.value).toBe(sentence)
  })

  it('saves server provenance together with newly generated audio', async () => {
    const cache = {
      id: 'tts-id',
      model: 'tts-1',
      provider: 'aihubmix.com',
      voice: 'alloy',
      requestedVoice: 'Kore',
      createdAt: '2026-10-05T00:00:00Z',
    }
    getLocalTtsMock.mockResolvedValueOnce(null)
    generateTtsMock.mockResolvedValueOnce({ audioBase64: 'QUJD', cache })
    const started = await useTts().speak('Hello.', 'en', 1)
    expect(started).toBe(true)
    expect(saveLocalTtsMock).toHaveBeenCalledWith('mp3_v1_1_default_hello.', 'QUJD', cache)
  })

  it('uses AI audio for a non-Han sentence longer than the old 250 character limit', async () => {
    const tts = useTts()
    const sentence = 'a'.repeat(300)

    const started = await tts.speak(sentence)

    expect(started).toBe(true)
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

  it('ignores empty input without starting playback', async () => {
    const tts = useTts()
    expect(await tts.speak(null)).toBe(false)
    expect(await tts.speak(undefined)).toBe(false)
    expect(await tts.speak('')).toBe(false)
    expect(getLocalTtsMock).not.toHaveBeenCalled()
  })

  it('does not clear a newer request for the same text when an old cache lookup completes', async () => {
    const old = deferred<Blob>()
    getLocalTtsMock.mockReturnValueOnce(old.promise)
    const tts = useTts()
    const first = tts.speak('same')
    await tts.speak('same')
    old.resolve(new Blob(['old']))
    expect(await first).toBe(false)
    expect(tts.currentText.value).toBe('same')
    expect(tts.isPlaying.value).toBe(true)
    expect(MockAudio.instances).toHaveLength(1)
  })

  it('does not fall back or log a stale rejection after another request starts', async () => {
    const old = deferred<Blob>()
    getLocalTtsMock.mockReturnValueOnce(old.promise)
    const tts = useTts()
    const first = tts.speak('old')
    await tts.speak('new')
    old.reject(new Error('late failure'))
    expect(await first).toBe(false)
    expect(tts.currentText.value).toBe('new')
    expect(tts.isPlaying.value).toBe(true)
  })

  it('ignores obsolete audio callbacks and releases the active URL on completion', async () => {
    const tts = useTts()
    await tts.speak('first')
    const first = MockAudio.instances[0]
    await tts.speak('second')
    first.onended?.()
    expect(tts.currentText.value).toBe('second')
    expect(tts.isPlaying.value).toBe(true)
    MockAudio.instances[1].onended?.()
    expect(tts.currentText.value).toBeNull()
    expect(tts.isPlaying.value).toBe(false)
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(2)
  })

  it('cleans up a failed audio play even for non-Error rejections', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const tts = useTts()
    class FailedAudio extends MockAudio {
      play = vi.fn().mockRejectedValue('blocked')
    }
    vi.stubGlobal('Audio', FailedAudio)
    expect(await tts.speak('failed')).toBe(false)
    expect(tts.isPlaying.value).toBe(false)
    expect(tts.isLoading.value).toBe(false)
    expect(tts.currentText.value).toBeNull()
    expect(URL.revokeObjectURL).toHaveBeenCalledOnce()
  })

  it('gets reactive book context from its provider and allows explicit overrides', async () => {
    const book = { id: 7, language: 'ru' }
    let tts!: ReturnType<typeof useTts>
    const child = defineComponent({
      setup() {
        tts = useTts()

        return () => h('div')
      },
    })
    const wrapper = mount(defineComponent({
      setup() {
        provide(TTS_BOOK_CONTEXT_KEY, () => book)

        return () => h(child)
      },
    }))
    await tts.speak('Hello.')
    expect(getLocalTtsMock).toHaveBeenLastCalledWith('mp3_v1_7_default_hello.')
    await tts.speak('Hello.', 'en', 8)
    expect(getLocalTtsMock).toHaveBeenLastCalledWith('mp3_v1_8_default_hello.')
    wrapper.unmount()
  })

  it('generates dictionary audio and honors cache bypass', async () => {
    generateGenericTtsMock.mockResolvedValue({ audioBase64: 'QUJD', cache: {} })
    const tts = useTts()
    expect(await tts.speak(
      'word',
      'ru',
      undefined,
      true,
    )).toBe(true)
    expect(generateGenericTtsMock).toHaveBeenCalledWith(
      'word',
      'default',
      expect.any(AbortSignal),
      true,
    )
    expect(saveLocalTtsMock).toHaveBeenCalled()
  })

  it('settles Web Speech fallback when stopped even if the browser emits no cancel event', async () => {
    const settings = useGlobalSettingsStore()
    settings.fallbackToWebSpeech = true
    getLocalTtsMock.mockResolvedValue(null)
    generateGenericTtsMock.mockRejectedValue(new Error('unavailable'))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    class Utterance {
      constructor(public text: string) {}
      lang = ''
      rate = 1
    }
    vi.stubGlobal('SpeechSynthesisUtterance', Utterance)
    const speech = { cancel: vi.fn(), speak: vi.fn(), getVoices: () => [] }
    Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: speech })
    const tts = useTts()
    const promise = tts.speak('fallback', 'ru')
    await flushPromises()
    expect(speech.speak).toHaveBeenCalledWith(expect.objectContaining({ lang: 'ru-RU' }))
    tts.stop()
    await expect(promise).resolves.toBe(false)
    expect(tts.currentText.value).toBeNull()
    Reflect.deleteProperty(window, 'speechSynthesis')
  })

  it.each(['en-US', 'zh-CN', 'ru-RU'])('uses a matching browser voice for %s and settles on speech completion', async (lang) => {
    useGlobalSettingsStore().fallbackToWebSpeech = true
    class Utterance {
      constructor(public text: string) {}
      lang = ''
      rate = 1
      onstart?: () => void
      onend?: () => void
    }
    vi.stubGlobal('SpeechSynthesisUtterance', Utterance)
    const voice = { lang, name: 'Matching' }
    const speech = { cancel: vi.fn(), speak: vi.fn(), getVoices: () => [voice] }
    Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: speech })
    const tts = useTts()
    const promise = tts.speak('x'.repeat(351), lang)
    expect(speech.speak).toHaveBeenCalledWith(expect.objectContaining({ voice, lang }))
    const utterance = speech.speak.mock.calls[0][0] as Utterance
    utterance.onstart?.()
    expect(tts.isPlaying.value).toBe(true)
    utterance.onend?.()
    await expect(promise).resolves.toBe(true)
    expect(tts.currentText.value).toBeNull()
    Reflect.deleteProperty(window, 'speechSynthesis')
  })

  it('handles unavailable Web Speech and its synchronous failures', async () => {
    const tts = useTts()
    useGlobalSettingsStore().fallbackToWebSpeech = true
    expect(await tts.speak('x'.repeat(351))).toBe(false)
    expect(tts.currentText.value).toBeNull()
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: { cancel: vi.fn(), getVoices: vi.fn(), speak: vi.fn() } })
    vi.stubGlobal('SpeechSynthesisUtterance', class {
      constructor() {
        throw new Error('unavailable')
      }
    })
    expect(await tts.speak('x'.repeat(351))).toBe(false)
    expect(tts.isPlaying.value).toBe(false)
    Reflect.deleteProperty(window, 'speechSynthesis')
  })

  it('ignores old Web Speech events after replacement with the same text', async () => {
    useGlobalSettingsStore().fallbackToWebSpeech = true
    class Utterance {
      constructor(public text: string) {}
      onstart?: () => void
      onend?: () => void
      onerror?: (event: { error: string }) => void
    }
    vi.stubGlobal('SpeechSynthesisUtterance', Utterance)
    const speech = { cancel: vi.fn(), speak: vi.fn(), getVoices: () => [] }
    Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: speech })
    const tts = useTts()
    const text = 'x'.repeat(351)
    const first = tts.speak(text)
    const second = tts.speak(text)
    await expect(first).resolves.toBe(false)
    const old = speech.speak.mock.calls[0][0] as Utterance
    old.onend?.()
    expect(tts.currentText.value).toBe(text)
    expect(tts.isPlaying.value).toBe(true)
    const active = speech.speak.mock.calls[1][0] as Utterance
    active.onerror?.({ error: 'canceled' })
    await expect(second).resolves.toBe(false)
    expect(tts.currentText.value).toBeNull()
    Reflect.deleteProperty(window, 'speechSynthesis')
  })

  it('settles without playback when generated audio is not available in the local cache', async () => {
    generateGenericTtsMock.mockResolvedValue({ audioBase64: 'QUJD', cache: {} })
    getLocalTtsMock.mockResolvedValue(null)
    const tts = useTts()
    expect(await tts.speak('missing')).toBe(false)
    expect(tts.isLoading.value).toBe(false)
    expect(tts.currentText.value).toBeNull()
  })
})
