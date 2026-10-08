import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, withDirectives } from 'vue'
import { vRipple } from './v-ripple'

function setup(value?: boolean) {
  return mount(defineComponent({
    setup: () => () => withDirectives(h('button', [h('span', { class: 'label' }, 'Label')]), [[vRipple, value]]),
  }))
}

describe('vRipple', () => {
  const wrappers: ReturnType<typeof setup>[] = []

  function create(value?: boolean) {
    const wrapper = setup(value)
    wrappers.push(wrapper)

    return wrapper
  }

  beforeEach(() => vi.useFakeTimers())
  afterEach(() => {
    wrappers.splice(0).forEach(wrapper => wrapper.unmount())
    document.getElementById('ripple-style')?.remove()
    vi.clearAllTimers()
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it.each([undefined, true])('enables ripple with value %s', (value) => {
    const wrapper = create(value)
    expect(wrapper.element.style.position).toBe('relative')
    expect(wrapper.element.style.overflow).toBe('hidden')
    wrapper.element.dispatchEvent(new MouseEvent('click'))
    expect(wrapper.findAll('.ripple')).toHaveLength(1)
  })

  it('does not change the element or inject styles when disabled', () => {
    const wrapper = create(false)
    expect(wrapper.element.getAttribute('style')).toBeNull()
    wrapper.element.dispatchEvent(new MouseEvent('click'))
    expect(wrapper.find('.ripple').exists()).toBe(false)
    expect(document.getElementById('ripple-style')).toBeNull()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('centers the circle at the click relative to the element', () => {
    const wrapper = create()
    vi.spyOn(wrapper.element, 'getBoundingClientRect').mockReturnValue(new DOMRect(
      10,
      20,
      100,
      40,
    ))
    wrapper.element.dispatchEvent(new MouseEvent('click', { clientX: 40, clientY: 50 }))
    const circle = wrapper.element.querySelector<HTMLElement>('.ripple')!
    expect(circle.style.width).toBe('100px')
    expect(circle.style.height).toBe('100px')
    expect(circle.style.left).toBe('-20px')
    expect(circle.style.top).toBe('-20px')
    expect(circle.style.pointerEvents).toBe('none')
    expect(circle.style.animation).toBe('ripple 600ms linear')
  })

  it('uses height for tall elements', () => {
    const wrapper = create()
    vi.spyOn(wrapper.element, 'getBoundingClientRect').mockReturnValue(new DOMRect(
      0,
      0,
      40,
      100,
    ))
    wrapper.element.dispatchEvent(new MouseEvent('click'))
    expect(wrapper.element.querySelector<HTMLElement>('.ripple')!.style.width).toBe('100px')
  })

  it('removes the circle after 600ms while preserving the label', () => {
    const wrapper = create()
    wrapper.element.dispatchEvent(new MouseEvent('click'))
    vi.advanceTimersByTime(599)
    expect(wrapper.find('.ripple').exists()).toBe(true)
    vi.advanceTimersByTime(1)
    expect(wrapper.find('.ripple').exists()).toBe(false)
    expect(wrapper.find('.label').text()).toBe('Label')
  })

  it('replaces the circle without its old timer removing the new one', () => {
    const wrapper = create()
    wrapper.element.dispatchEvent(new MouseEvent('click'))
    const first = wrapper.find('.ripple').element
    vi.advanceTimersByTime(300)
    wrapper.element.dispatchEvent(new MouseEvent('click'))
    expect(wrapper.findAll('.ripple')).toHaveLength(1)
    expect(wrapper.find('.ripple').element).not.toBe(first)
    expect(first.parentElement).toBeNull()
    vi.advanceTimersByTime(300)
    expect(wrapper.find('.ripple').exists()).toBe(true)
    vi.advanceTimersByTime(300)
    expect(wrapper.find('.ripple').exists()).toBe(false)
  })

  it('injects animation styles only once for multiple elements', () => {
    create()
    const style = document.getElementById('ripple-style')
    create()
    expect(document.querySelectorAll('#ripple-style')).toHaveLength(1)
    expect(document.getElementById('ripple-style')).toBe(style)
    expect(style?.textContent).toContain('@keyframes ripple')
  })
})
