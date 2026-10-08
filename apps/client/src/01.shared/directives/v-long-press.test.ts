import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, withDirectives } from 'vue'
import { vLongPress } from './v-long-press'

function setup() {
  const callback = vi.fn()
  const wrapper = mount(defineComponent({
    setup: () => () => withDirectives(h('button'), [[vLongPress, callback]]),
  }))

  return { wrapper, el: wrapper.element, callback }
}

function touch(
  el: Element,
  type: string,
  clientX = 20,
  clientY = 30,
) {
  const event = new Event(type)
  Object.defineProperty(event, 'touches', { value: [{ clientX, clientY }] })
  el.dispatchEvent(event)

  return event
}

describe('vLongPress', () => {
  let subject: ReturnType<typeof setup>

  beforeEach(() => {
    vi.useFakeTimers()
    subject = setup()
    // Ignore DOM environment timers created during the initial mount.
    vi.clearAllTimers()
  })

  afterEach(() => {
    subject.wrapper.unmount()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('fires once at 600ms with the original event and vibrates', () => {
    const vibrate = vi.fn()
    vi.stubGlobal('navigator', { vibrate })
    const event = new MouseEvent('mousedown')
    subject.el.dispatchEvent(event)
    vi.advanceTimersByTime(599)
    expect(subject.callback).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(subject.callback).toHaveBeenCalledExactlyOnceWith(event)
    expect(vibrate).toHaveBeenCalledExactlyOnceWith(50)
    vi.advanceTimersByTime(600)
    expect(subject.callback).toHaveBeenCalledTimes(1)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('supports touch without vibration support', () => {
    vi.stubGlobal('navigator', {})
    const event = touch(subject.el, 'touchstart')
    vi.advanceTimersByTime(600)
    expect(subject.callback).toHaveBeenCalledExactlyOnceWith(event)
  })

  it.each([1, 2])('ignores mouse button %i', (button) => {
    subject.el.dispatchEvent(new MouseEvent('mousedown', { button }))
    vi.advanceTimersByTime(600)
    expect(subject.callback).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
  })

  it.each(['mouseup', 'mouseleave', 'touchend', 'touchcancel'])('cancels on %s', (type) => {
    subject.el.dispatchEvent(new MouseEvent('mousedown'))
    vi.advanceTimersByTime(300)
    subject.el.dispatchEvent(new Event(type))
    vi.advanceTimersByTime(600)
    expect(subject.callback).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
  })

  it.each([[11, 0], [0, -11]])('cancels mouse movement by (%i, %i)', (clientX, clientY) => {
    subject.el.dispatchEvent(new MouseEvent('mousedown'))
    subject.el.dispatchEvent(new MouseEvent('mousemove', { clientX, clientY }))
    vi.advanceTimersByTime(600)
    expect(subject.callback).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('allows mouse movement up to 10px on both axes', () => {
    subject.el.dispatchEvent(new MouseEvent('mousedown', { clientX: 20, clientY: 30 }))
    subject.el.dispatchEvent(new MouseEvent('mousemove', { clientX: 30, clientY: 20 }))
    vi.advanceTimersByTime(600)
    expect(subject.callback).toHaveBeenCalledTimes(1)
  })

  it('cancels touch movement beyond 10px', () => {
    touch(subject.el, 'touchstart')
    touch(
      subject.el,
      'touchmove',
      20,
      41,
    )
    vi.advanceTimersByTime(600)
    expect(subject.callback).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('ignores inactive movement and allows small touch movements', () => {
    touch(
      subject.el,
      'touchmove',
      100,
      100,
    )
    touch(subject.el, 'touchstart')
    touch(
      subject.el,
      'touchmove',
      30,
      20,
    )
    vi.advanceTimersByTime(600)
    expect(subject.callback).toHaveBeenCalledTimes(1)
  })

  it('cancels on selectionchange and removes its listener', () => {
    const remove = vi.spyOn(document, 'removeEventListener')
    subject.el.dispatchEvent(new MouseEvent('mousedown'))
    vi.spyOn(window, 'getSelection').mockReturnValue({ toString: () => 'selected' } as Selection)
    document.dispatchEvent(new Event('selectionchange'))
    vi.advanceTimersByTime(600)
    expect(subject.callback).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
    expect(remove).toHaveBeenCalledWith('selectionchange', expect.any(Function))
  })

  it('checks selection again when the timer expires', () => {
    subject.el.dispatchEvent(new MouseEvent('mousedown'))
    vi.spyOn(window, 'getSelection').mockReturnValue({ toString: () => 'selected' } as Selection)
    vi.advanceTimersByTime(600)
    expect(subject.callback).not.toHaveBeenCalled()
  })

  it('ignores whitespace-only selection', () => {
    vi.spyOn(window, 'getSelection').mockReturnValue({ toString: () => '  ' } as Selection)
    subject.el.dispatchEvent(new MouseEvent('mousedown'))
    document.dispatchEvent(new Event('selectionchange'))
    vi.advanceTimersByTime(600)
    expect(subject.callback).toHaveBeenCalledTimes(1)
  })

  it('allows another press after cancellation', () => {
    subject.el.dispatchEvent(new MouseEvent('mousedown'))
    subject.el.dispatchEvent(new MouseEvent('mousemove', { clientX: 11 }))
    subject.el.dispatchEvent(new MouseEvent('mousedown'))
    vi.advanceTimersByTime(600)
    expect(subject.callback).toHaveBeenCalledTimes(1)
  })

  it('cleans pending timers and all listeners on unmount', () => {
    const remove = vi.spyOn(subject.el, 'removeEventListener')
    const removeSelection = vi.spyOn(document, 'removeEventListener')
    subject.el.dispatchEvent(new MouseEvent('mousedown'))
    subject.wrapper.unmount()
    expect(vi.getTimerCount()).toBe(0)
    expect(removeSelection).toHaveBeenCalledWith('selectionchange', expect.any(Function))

    for (const type of ['mousedown', 'touchstart', 'mouseup', 'mouseleave', 'touchend', 'touchcancel', 'mousemove', 'touchmove']) {
      expect(remove).toHaveBeenCalledWith(type, expect.any(Function))
    }

    subject.el.dispatchEvent(new MouseEvent('mousedown'))
    touch(subject.el, 'touchstart')
    vi.advanceTimersByTime(600)
    expect(subject.callback).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
  })
})
