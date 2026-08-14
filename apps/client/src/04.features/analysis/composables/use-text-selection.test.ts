import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Мокаем хранилище анализа: тестируем таймер длинного нажатия,
// а не сетевой слой (performSentenceAnalysis ходит в API).
const { handleSentenceAnalysis, speak, stop } = vi.hoisted(() => ({
  handleSentenceAnalysis: vi.fn().mockResolvedValue(undefined),
  speak: vi.fn().mockResolvedValue(true),
  stop: vi.fn(),
}))

vi.mock('~/01.shared/store/analysis/analysis.store', () => ({
  useAnalysisStore: () => ({
    closePopover: vi.fn(),
    closeSelectionTooltip: vi.fn(),
    handleSentenceAnalysis,
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
