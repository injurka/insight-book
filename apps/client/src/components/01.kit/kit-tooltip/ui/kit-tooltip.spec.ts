import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import KitTooltip from './kit-tooltip.vue'

describe('kit-tooltip', () => {
  beforeEach(() => {
    vi.useFakeTimers()

    // Mock matchMedia for useMediaQuery('(hover: hover)')
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation(query => ({
        matches: query === '(hover: hover)', // return true for hover capability
        media: query,
        onchange: null,
        addListener: vi.fn(), // deprecated
        removeListener: vi.fn(), // deprecated
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  const mountTooltip = (props = {}, slots = {}) => {
    return mount(KitTooltip, {
      props,
      slots: {
        default: '<button>Hover me</button>',
        ...slots,
      },
      global: {
        stubs: {
          Teleport: true,
          Transition: true,
        },
      },
    })
  }

  it('renders the trigger slot correctly', () => {
    const wrapper = mountTooltip()
    expect(wrapper.find('.kit-tooltip-trigger').text()).toBe('Hover me')
  })

  it('does not show tooltip initially', () => {
    const wrapper = mountTooltip({ text: 'Tooltip text' })
    expect(wrapper.find('.kit-tooltip-floating').exists()).toBe(false)
  })

  it('shows tooltip on mouseenter after delay', async () => {
    const wrapper = mountTooltip({ text: 'Tooltip text' })

    await wrapper.find('.kit-tooltip-wrapper').trigger('mouseenter')

    // Initially not visible (due to timeout)
    expect(wrapper.find('.kit-tooltip-floating').exists()).toBe(false)

    // Fast-forward timers
    vi.runAllTimers()
    await wrapper.vm.$nextTick()

    expect(wrapper.find('.kit-tooltip-floating').exists()).toBe(true)
    expect(wrapper.find('.kit-tooltip-floating').text()).toBe('Tooltip text')
  })

  it('hides tooltip on mouseleave', async () => {
    const wrapper = mountTooltip({ text: 'Tooltip text' })

    await wrapper.find('.kit-tooltip-wrapper').trigger('mouseenter')
    vi.runAllTimers()
    await wrapper.vm.$nextTick()

    expect(wrapper.find('.kit-tooltip-floating').exists()).toBe(true)

    await wrapper.find('.kit-tooltip-wrapper').trigger('mouseleave')
    vi.runAllTimers()
    await wrapper.vm.$nextTick()

    expect(wrapper.find('.kit-tooltip-floating').exists()).toBe(false)
  })

  it('hides tooltip on click', async () => {
    const wrapper = mountTooltip({ text: 'Tooltip text' })

    await wrapper.find('.kit-tooltip-wrapper').trigger('mouseenter')
    vi.runAllTimers()
    await wrapper.vm.$nextTick()

    expect(wrapper.find('.kit-tooltip-floating').exists()).toBe(true)

    await wrapper.find('.kit-tooltip-wrapper').trigger('click')
    vi.runAllTimers()
    await wrapper.vm.$nextTick()

    expect(wrapper.find('.kit-tooltip-floating').exists()).toBe(false)
  })

  it('does not show tooltip if disabled', async () => {
    const wrapper = mountTooltip({ text: 'Tooltip text', disabled: true })

    await wrapper.find('.kit-tooltip-wrapper').trigger('mouseenter')
    vi.runAllTimers()
    await wrapper.vm.$nextTick()

    expect(wrapper.find('.kit-tooltip-floating').exists()).toBe(false)
  })

  it('does not show tooltip if text and content slot are empty', async () => {
    const wrapper = mountTooltip() // no text, no content slot

    await wrapper.find('.kit-tooltip-wrapper').trigger('mouseenter')
    vi.runAllTimers()
    await wrapper.vm.$nextTick()

    expect(wrapper.find('.kit-tooltip-floating').exists()).toBe(false)
  })

  it('renders content slot if provided', async () => {
    const wrapper = mountTooltip({}, { content: '<span class="custom-content">Custom</span>' })

    await wrapper.find('.kit-tooltip-wrapper').trigger('mouseenter')
    vi.runAllTimers()
    await wrapper.vm.$nextTick()

    expect(wrapper.find('.kit-tooltip-floating').exists()).toBe(true)
    expect(wrapper.find('.custom-content').exists()).toBe(true)
    expect(wrapper.find('.custom-content').text()).toBe('Custom')
  })

  it('unmounts and calls hide', () => {
    const wrapper = mountTooltip({ text: 'Tooltip text' })
    wrapper.unmount()
  })
})
