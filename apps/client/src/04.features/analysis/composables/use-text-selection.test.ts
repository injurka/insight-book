import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Мокаем хранилище анализа: тестируем таймер длинного нажатия,
// а не сетевой слой (performSentenceAnalysis ходит в API).
const { handleSentenceAnalysis, speak, stop, openGrammarPopover } = vi.hoisted(() => ({
  handleSentenceAnalysis: vi.fn().mockResolvedValue(undefined),
  speak: vi.fn().mockResolvedValue(true),
  stop: vi.fn(),
  openGrammarPopover: vi.fn(),
}))

vi.mock('~/01.shared/store/analysis/analysis.store', () => ({
  useAnalysisStore: () => ({
    closePopover: vi.fn(),
    closeSelectionTooltip: vi.fn(),
    handleSentenceAnalysis,
    openGrammarPopover,
  }),
}))

vi.mock('~/01.shared/composables/use-tts', async () => {
  const { ref } = await import('vue')

  return {
    useTts: () => ({
      speak,
      stop,
      isPlaying: ref(false),
      isLoading: ref(false),
      currentText: ref(null),
    }),
  }
})

const { useTextSelection } = await import('./use-text-selection')

function makeSentenceElement(rawSent: string): HTMLElement {
  const el = document.createElement('span')
  el.className = 'sentence'
  el.dataset.rawSent = encodeURIComponent(rawSent)

  return el
}

/** Синтетическое touch-событие: jsdom не умеет TouchEvent/Touch. */
function makeTouchEvent(
  type: string,
  target: HTMLElement,
  x: number,
  y: number,
): Event {
  const e = new Event(type, { bubbles: true, cancelable: true })
  Object.defineProperty(e, 'target', { value: target })
  Object.defineProperty(e, 'touches', { value: [{ clientX: x, clientY: y }] })

  return e
}

function setup() {
  const selection = useTextSelection()

  return { selection }
}

describe('useTextSelection press timer', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.useFakeTimers()
    handleSentenceAnalysis.mockClear()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('opens sentence analysis after 500ms hold without movement', () => {
    const { selection } = setup()
    const el = makeSentenceElement('Привет мир')
    document.body.appendChild(el)

    selection.onPointerDown(makeTouchEvent(
      'touchstart',
      el,
      100,
      100,
    ))
    vi.advanceTimersByTime(600)

    expect(handleSentenceAnalysis).toHaveBeenCalledWith('Привет мир', expect.any(String))
    el.remove()
  })

  it('cancels press when the pointer moves more than 10px (scroll-like drag)', () => {
    const { selection } = setup()
    const el = makeSentenceElement('Привет мир')
    document.body.appendChild(el)

    selection.onPointerDown(makeTouchEvent(
      'touchstart',
      el,
      100,
      100,
    ))
    window.dispatchEvent(makeTouchEvent(
      'touchmove',
      el,
      120,
      140,
    ))
    vi.advanceTimersByTime(600)

    expect(handleSentenceAnalysis).not.toHaveBeenCalled()
    el.remove()
  })

  it('cancels press when the page scrolls', () => {
    const { selection } = setup()
    const el = makeSentenceElement('Привет мир')
    document.body.appendChild(el)

    selection.onPointerDown(makeTouchEvent(
      'touchstart',
      el,
      100,
      100,
    ))
    window.dispatchEvent(new Event('scroll'))
    vi.advanceTimersByTime(600)

    expect(handleSentenceAnalysis).not.toHaveBeenCalled()
    el.remove()
  })

  it('cancels press on quick tap (pointerup before 500ms)', () => {
    const { selection } = setup()
    const el = makeSentenceElement('Привет мир')
    document.body.appendChild(el)

    selection.onPointerDown(makeTouchEvent(
      'touchstart',
      el,
      100,
      100,
    ))
    selection.onPointerUp()
    vi.advanceTimersByTime(600)

    expect(handleSentenceAnalysis).not.toHaveBeenCalled()
    el.remove()
  })

  it('does not cancel on small movement below the threshold (<10px)', () => {
    const { selection } = setup()
    const el = makeSentenceElement('Привет мир')
    document.body.appendChild(el)

    selection.onPointerDown(makeTouchEvent(
      'touchstart',
      el,
      100,
      100,
    ))
    window.dispatchEvent(makeTouchEvent(
      'touchmove',
      el,
      105,
      106,
    ))
    vi.advanceTimersByTime(600)

    expect(handleSentenceAnalysis).toHaveBeenCalled()
    el.remove()
  })
})

describe('useTextSelection tts button', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    speak.mockReset()
    speak.mockResolvedValue(true)
    stop.mockReset()
  })

  function makeTtsButton(text = 'Hello world'): HTMLElement {
    const btn = document.createElement('button')
    btn.className = 'sentence-tts-btn'
    btn.type = 'button'
    btn.dataset.ttsText = encodeURIComponent(text)
    document.body.appendChild(btn)

    return btn
  }

  function clickOn(el: HTMLElement): MouseEvent {
    const e = new MouseEvent('click', { bubbles: true, cancelable: true })
    Object.defineProperty(e, 'target', { value: el })

    return e
  }

  async function flushMicrotasks() {
    await Promise.resolve()
    await Promise.resolve()
  }

  it('запускает TTS и помечает кнопку is-playing', async () => {
    const { selection } = setup()
    const btn = makeTtsButton()

    selection.onWordClick(clickOn(btn))
    await flushMicrotasks()

    expect(speak).toHaveBeenCalledTimes(1)
    expect(speak).toHaveBeenCalledWith('Hello world')
    expect(btn.classList.contains('is-playing')).toBe(true)

    btn.remove()
  })

  it('повторный клик по играющей кнопке останавливает TTS без нового запроса', async () => {
    const { selection } = setup()
    const btn = makeTtsButton()

    selection.onWordClick(clickOn(btn))
    await flushMicrotasks()

    selection.onWordClick(clickOn(btn))
    await flushMicrotasks()

    expect(speak).toHaveBeenCalledTimes(1)
    expect(stop).toHaveBeenCalledTimes(1)
    expect(btn.classList.contains('is-playing')).toBe(false)

    btn.remove()
  })

  it('не оставляет is-playing, если speak отклонил текст', async () => {
    const { selection } = setup()
    const btn = makeTtsButton()
    speak.mockResolvedValueOnce(false)

    selection.onWordClick(clickOn(btn))
    await flushMicrotasks()

    expect(btn.classList.contains('is-playing')).toBe(false)

    btn.remove()
  })
})

describe('useTextSelection translation blur & pointer down guards', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.useFakeTimers()
    handleSentenceAnalysis.mockClear()
    openGrammarPopover.mockClear()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  function clickOn(el: HTMLElement): MouseEvent {
    const e = new MouseEvent('click', { bubbles: true, cancelable: true })
    Object.defineProperty(e, 'target', { value: el })

    return e
  }

  it('снимает класс is-blurred при клике на заблюренный interleaved-translation', () => {
    const { selection } = setup()
    const span = document.createElement('span')
    span.className = 'interleaved-translation is-blurred'
    const textSpan = document.createElement('span')
    textSpan.className = 'translation-text'
    textSpan.textContent = 'Перевод предложения'
    span.appendChild(textSpan)
    document.body.appendChild(span)

    const event = clickOn(textSpan)
    const stopSpy = vi.spyOn(event, 'stopPropagation')

    selection.onWordClick(event)

    expect(span.classList.contains('is-blurred')).toBe(false)
    expect(stopSpy).toHaveBeenCalled()
    span.remove()
  })

  it('снимает класс is-blurred при клике на заблюренный split-translation', () => {
    const { selection } = setup()
    const span = document.createElement('span')
    span.className = 'split-translation is-blurred'
    const textSpan = document.createElement('span')
    textSpan.className = 'translation-text'
    textSpan.textContent = 'Параллельный перевод'
    span.appendChild(textSpan)
    document.body.appendChild(span)

    selection.onWordClick(clickOn(textSpan))

    expect(span.classList.contains('is-blurred')).toBe(false)
    span.remove()
  })

  it('не запускает анализ предложения при pointerdown на переводе', () => {
    const { selection } = setup()
    const sentence = makeSentenceElement('Sentence text')
    const translation = document.createElement('span')
    translation.className = 'interleaved-translation is-blurred'
    sentence.appendChild(translation)
    document.body.appendChild(sentence)

    selection.onPointerDown(makeTouchEvent(
      'touchstart',
      translation,
      50,
      50,
    ))
    vi.advanceTimersByTime(600)

    expect(handleSentenceAnalysis).not.toHaveBeenCalled()
    sentence.remove()
  })
})
