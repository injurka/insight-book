import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import KitInput from './kit-input.vue'

describe('kitInput', () => {
  it('renders correctly with default props', () => {
    const wrapper = mount(KitInput)

    expect(wrapper.exists()).toBe(true)
    const input = wrapper.find('input')
    expect(input.exists()).toBe(true)
    expect(input.attributes('type')).toBe('text')
    expect(input.classes()).toContain('kit-input--size-md')
  })

  it('renders with placeholder', () => {
    const placeholder = 'Enter your name'
    const wrapper = mount(KitInput, {
      props: { placeholder },
    })

    const input = wrapper.find('input')
    expect(input.attributes('placeholder')).toBe(placeholder)
  })

  it('applies rounded class when rounded prop is true', () => {
    const wrapper = mount(KitInput, {
      props: { rounded: true },
    })

    const wrapperDiv = wrapper.find('.kit-input-wrapper')
    expect(wrapperDiv.classes()).toContain('is-rounded')
  })

  it('applies solo class when variant is solo', () => {
    const wrapper = mount(KitInput, {
      props: { variant: 'solo' },
    })

    const wrapperDiv = wrapper.find('.kit-input-wrapper')
    expect(wrapperDiv.classes()).toContain('is-solo')
  })

  it('applies size classes correctly', () => {
    const sizes = ['xs', 'sm', 'md', 'lg'] as const

    sizes.forEach((size) => {
      const wrapper = mount(KitInput, {
        props: { size },
      })

      const input = wrapper.find('input')
      expect(input.classes()).toContain(`kit-input--size-${size}`)
    })
  })

  it('emits update:modelValue on text input', async () => {
    const wrapper = mount(KitInput, {
      props: { modelValue: '' },
    })

    const input = wrapper.find('input')
    await input.setValue('Hello World')

    expect(wrapper.emitted('update:modelValue')).toBeTruthy()
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['Hello World'])
  })

  it('emits update:modelValue as number when type is number', async () => {
    const wrapper = mount(KitInput, {
      props: { type: 'number', modelValue: null },
    })

    const input = wrapper.find('input')
    await input.setValue('42')

    expect(wrapper.emitted('update:modelValue')).toBeTruthy()
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([42])
  })

  it('emits update:modelValue as null when type is number and input is cleared', async () => {
    const wrapper = mount(KitInput, {
      props: { type: 'number', modelValue: 42 },
    })

    const input = wrapper.find('input')
    await input.setValue('')

    expect(wrapper.emitted('update:modelValue')).toBeTruthy()
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([null])
  })

  it('passes down non-prop attributes to the input element', () => {
    const wrapper = mount(KitInput, {
      attrs: {
        'id': 'my-input',
        'data-test': 'input-element',
        'disabled': true,
      },
    })

    const input = wrapper.find('input')
    expect(input.attributes('id')).toBe('my-input')
    expect(input.attributes('data-test')).toBe('input-element')
    expect(input.attributes('disabled')).toBeDefined()

    // Wrapper should not have the attributes because of inheritAttrs: false
    const wrapperDiv = wrapper.find('.kit-input-wrapper')
    expect(wrapperDiv.attributes('id')).toBeUndefined()
  })

  it('sets data-tracking-mask for password type', () => {
    const wrapper = mount(KitInput, {
      props: { type: 'password' },
    })

    const input = wrapper.find('input')
    expect(input.attributes('data-tracking-mask')).toBe('true')
  })

  it('applies color class when color prop is provided', () => {
    const wrapper = mount(KitInput, {
      props: { color: 'secondary' },
    })

    const input = wrapper.find('input')
    const wrapperDiv = wrapper.find('.kit-input-wrapper')
    expect(input.classes()).toContain('kit-input--color-secondary')
    expect(wrapperDiv.classes()).toContain('kit-input-wrapper--color-secondary')
  })

  it('renders prepend icon when icon prop is provided', () => {
    const wrapper = mount(KitInput, {
      props: { icon: 'mdi:magnify' },
    })

    const wrapperDiv = wrapper.find('.kit-input-wrapper')
    expect(wrapperDiv.classes()).toContain('has-prepend')
    expect(wrapper.find('.kit-input-prepend').exists()).toBe(true)
  })

  it('clears model value when clear button is clicked', async () => {
    const wrapper = mount(KitInput, {
      props: { clearable: true, modelValue: 'Search query' },
    })

    const clearBtn = wrapper.find('.kit-input-clear-btn')
    expect(clearBtn.exists()).toBe(true)
    await clearBtn.trigger('click')
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([''])
  })
})
