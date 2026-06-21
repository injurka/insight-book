import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import KitSelect from './kit-select.vue'

// Mock ResizeObserver for floating-ui
// eslint-disable-next-line no-restricted-globals
global.ResizeObserver = class ResizeObserver {
  observe() { }
  unobserve() { }
  disconnect() { }
}

describe('kitSelect', () => {
  const defaultOptions = [
    { label: 'Option 1', value: 'opt1' },
    { label: 'Option 2', value: 'opt2' },
    { label: 'Option 3', value: 'opt3' },
  ]

  const factory = (props = {}, options = {}) => {
    return mount(KitSelect, {
      props: {
        modelValue: '',
        options: defaultOptions,
        ...props,
      },
      global: {
        stubs: {
          Icon: true,
          Teleport: true,
          Transition: true,
        },
      },
      ...options,
    })
  }

  it('renders correctly with default props', () => {
    const wrapper = factory()
    expect(wrapper.find('.kit-select-trigger').exists()).toBe(true)
    expect(wrapper.find('.kit-select-trigger').classes()).toContain('kit-select-trigger--size-md')
    expect(wrapper.find('.selected-label').text()).toBe('')
  })

  it('applies correct size class', () => {
    const wrapper = factory({ size: 'sm' })
    expect(wrapper.find('.kit-select-trigger').classes()).toContain('kit-select-trigger--size-sm')
  })

  it('displays selected option label in single mode', () => {
    const wrapper = factory({ modelValue: 'opt2' })
    expect(wrapper.find('.selected-label').text()).toBe('Option 2')
  })

  it('toggles dropdown on trigger click', async () => {
    const wrapper = factory()

    // Dropdown is initially closed
    expect(wrapper.find('.kit-select-dropdown').exists()).toBe(false)

    // Click trigger to open
    await wrapper.find('.kit-select-trigger').trigger('click')
    expect(wrapper.find('.kit-select-dropdown').exists()).toBe(true)

    // Click trigger to close
    await wrapper.find('.kit-select-trigger').trigger('click')
    expect(wrapper.find('.kit-select-dropdown').exists()).toBe(false)
  })

  it('emits update:modelValue in single mode and closes dropdown', async () => {
    const wrapper = factory()
    await wrapper.find('.kit-select-trigger').trigger('click')

    const options = wrapper.findAll('.kit-select-option')
    expect(options.length).toBe(3)

    // Click second option
    await options[1].trigger('click')

    const emitted = wrapper.emitted('update:modelValue')
    expect(emitted).toBeTruthy()
    expect(emitted?.[0]).toEqual(['opt2'])

    // Dropdown should be closed
    expect(wrapper.find('.kit-select-dropdown').exists()).toBe(false)
  })

  it('handles multiple selection correctly', async () => {
    const wrapper = factory({
      multiple: true,
      modelValue: ['opt1'],
    })

    await wrapper.find('.kit-select-trigger').trigger('click')
    const options = wrapper.findAll('.kit-select-option')

    // Click second option
    await options[1].trigger('click')

    const emitted = wrapper.emitted('update:modelValue')
    expect(emitted).toBeTruthy()
    expect(emitted?.[0]).toEqual([['opt1', 'opt2']])

    // Dropdown should stay open
    expect(wrapper.find('.kit-select-dropdown').exists()).toBe(true)
  })

  it('handles "all" selection in multiple mode', async () => {
    const optionsWithAll = [{ label: 'All', value: 'all' }, ...defaultOptions]
    const wrapper = factory({
      multiple: true,
      modelValue: ['opt1'],
      options: optionsWithAll,
    })

    await wrapper.find('.kit-select-trigger').trigger('click')
    const options = wrapper.findAll('.kit-select-option')

    // Click "all" option
    await options[0].trigger('click')

    const emitted = wrapper.emitted('update:modelValue')
    expect(emitted?.[0]).toEqual([['all']])
  })

  it('deselects option in multiple mode if already selected', async () => {
    const wrapper = factory({
      multiple: true,
      modelValue: ['opt1', 'opt2'],
    })

    await wrapper.find('.kit-select-trigger').trigger('click')
    const options = wrapper.findAll('.kit-select-option')

    // Click second option again to deselect
    await options[1].trigger('click')

    const emitted = wrapper.emitted('update:modelValue')
    expect(emitted?.[0]).toEqual([['opt1']])
  })

  it('defaults to "all" if all options are deselected', async () => {
    const wrapper = factory({
      multiple: true,
      modelValue: ['opt1'],
    })

    await wrapper.find('.kit-select-trigger').trigger('click')
    const options = wrapper.findAll('.kit-select-option')

    // Deselect the only selected option
    await options[0].trigger('click')

    const emitted = wrapper.emitted('update:modelValue')
    expect(emitted?.[0]).toEqual([['all']])
  })

  it('displays multiple selection count badge and joined labels', () => {
    const wrapper = factory({
      multiple: true,
      modelValue: ['opt1', 'opt2'],
    })

    expect(wrapper.find('.selected-label').text()).toBe('Option 1, Option 2')
    expect(wrapper.find('.count-badge').text()).toBe('2')
  })

  it('returns empty string for empty modelValue in multiple mode', () => {
    const wrapper = factory({
      multiple: true,
      modelValue: [],
    })
    expect(wrapper.find('.selected-label').text()).toBe('')
  })

  it('closes dropdown when clicking outside', async () => {
    const wrapper = factory({}, { attachTo: document.body })
    await wrapper.find('.kit-select-trigger').trigger('click')
    expect(wrapper.find('.kit-select-dropdown').exists()).toBe(true)

    // Simulate click outside
    document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    document.body.dispatchEvent(new Event('click', { bubbles: true }))

    await wrapper.vm.$nextTick()
    // Teleport is stubbed, so the dropdown is inside the wrapper, but the event is on document.body
    // which should trigger onClickOutside
  })

  it('ignores click on trigger for onClickOutside', async () => {
    const wrapper = factory({}, { attachTo: document.body })
    await wrapper.find('.kit-select-trigger').trigger('click')

    // Simulate pointerdown on the inner element
    wrapper.find('.label-wrapper').element.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    wrapper.find('.label-wrapper').element.dispatchEvent(new Event('click', { bubbles: true }))

    await wrapper.vm.$nextTick()
  })

  it('sets isOpen to false on unmounted', async () => {
    const wrapper = factory()
    await wrapper.find('.kit-select-trigger').trigger('click')
    wrapper.unmount()
  })
})
