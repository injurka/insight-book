import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Мокаем хранилище анализа: тестируем таймер длинного нажатия,
// а не сетевой слой (performSentenceAnalysis ходит в API).
const { handleSentenceAnalysis } = vi.hoisted(() => ({
  handleSentenceAnalysis: vi.fn().mockResolvedValue(undefined),
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
      speak: vi.fn(),
      stop: vi.fn(),
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
