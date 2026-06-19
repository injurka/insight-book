import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import KitPrompt from './kit-prompt.vue'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}))

describe('KitPrompt', () => {
  const mountComponent = (props = {}) => {
    return mount(KitPrompt, {
      props: {
        visible: true,
        ...props,
      },
      global: {
        stubs: {
          KitDialog: {
            template: '<div class="kit-dialog-stub" :title="title" @click="$emit(\'update:visible\', false)"><slot /><slot name="footer" /></div>',
            props: ['title', 'visible'],
          },
          KitInput: {
            template: '<input class="kit-input-stub" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" @keyup.enter="$emit(\'keyup.enter\')" />',
            props: ['modelValue', 'type', 'placeholder'],
          },
          KitBtn: {
            template: '<button class="kit-btn-stub" @click="$emit(\'click\')"><slot /></button>',
            props: ['variant', 'color'],
          },
        },
      },
    })
  }

  it('renders correctly with default props', () => {
    const wrapper = mountComponent()
    expect(wrapper.exists()).toBe(true)
    expect(wrapper.find('.kit-input-stub').exists()).toBe(true)
    const buttons = wrapper.findAll('.kit-btn-stub')
    expect(buttons.length).toBe(2)
    expect(buttons[0].text()).toBe('kit.prompt.cancel')
    expect(buttons[1].text()).toBe('kit.prompt.confirm')
  })

  it('renders description if provided', () => {
    const wrapper = mountComponent({ description: 'Test Description' })
    expect(wrapper.find('.prompt-desc').text()).toBe('Test Description')
  })

  it('hides input if hideInput is true', () => {
    const wrapper = mountComponent({ hideInput: true })
    expect(wrapper.find('.kit-input-stub').exists()).toBe(false)
  })

  it('uses custom texts', () => {
    const wrapper = mountComponent({
      cancelText: 'Abort',
      confirmText: 'Proceed',
    })
    const buttons = wrapper.findAll('.kit-btn-stub')
    expect(buttons[0].text()).toBe('Abort')
    expect(buttons[1].text()).toBe('Proceed')
  })

  it('sets initial input value based on defaultValue when dialog opens', async () => {
    const wrapper = mountComponent({ visible: false, defaultValue: 'initial test' })
    await wrapper.setProps({ visible: true })
    
    const input = wrapper.find('.kit-input-stub')
    expect((input.element as HTMLInputElement).value).toBe('initial test')
  })

  it('emits submit with current value and closes dialog on confirm button click', async () => {
    const wrapper = mountComponent()
    const input = wrapper.find('.kit-input-stub')
    await input.setValue('typed value')
    
    const buttons = wrapper.findAll('.kit-btn-stub')
    await buttons[1].trigger('click') // Confirm button
    
    expect(wrapper.emitted('submit')).toBeDefined()
    expect(wrapper.emitted('submit')?.[0]).toEqual(['typed value'])
    expect(wrapper.emitted('update:visible')?.[0]).toEqual([false])
  })

  it('emits cancel and closes dialog on cancel button click', async () => {
    const wrapper = mountComponent()
    
    const buttons = wrapper.findAll('.kit-btn-stub')
    await buttons[0].trigger('click') // Cancel button
    
    expect(wrapper.emitted('cancel')).toBeDefined()
    expect(wrapper.emitted('update:visible')?.[0]).toEqual([false])
  })

  it('emits submit and closes dialog on enter key in input', async () => {
    const wrapper = mountComponent()
    const input = wrapper.find('.kit-input-stub')
    await input.setValue('enter value')
    await input.trigger('keyup.enter')
    
    expect(wrapper.emitted('submit')).toBeDefined()
    expect(wrapper.emitted('submit')?.[0]).toEqual(['enter value'])
    expect(wrapper.emitted('update:visible')?.[0]).toEqual([false])
  })

  it('updates visible model when KitDialog emits update:visible', async () => {
    const wrapper = mountComponent()
    await wrapper.find('.kit-dialog-stub').trigger('click')
    expect(wrapper.emitted('update:visible')).toBeDefined()
    expect(wrapper.emitted('update:visible')?.[0]).toEqual([false])
  })
})
