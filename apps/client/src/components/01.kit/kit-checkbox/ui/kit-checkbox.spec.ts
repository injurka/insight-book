import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import KitCheckbox from './kit-checkbox.vue'

describe('KitCheckbox', () => {
  it('renders correctly without label', () => {
    const wrapper = mount(KitCheckbox, {
      props: {
        modelValue: false,
      }
    })
    
    expect(wrapper.find('.checkbox-label').exists()).toBe(false)
    expect(wrapper.find('.checkbox-box').classes()).not.toContain('checked')
  })

  it('renders correctly with label', () => {
    const wrapper = mount(KitCheckbox, {
      props: {
        modelValue: false,
        label: 'Accept Terms'
      }
    })
    
    const label = wrapper.find('.checkbox-label')
    expect(label.exists()).toBe(true)
    expect(label.text()).toBe('Accept Terms')
  })

  it('adds checked class when modelValue is true', () => {
    const wrapper = mount(KitCheckbox, {
      props: {
        modelValue: true,
      }
    })
    
    expect(wrapper.find('.checkbox-box').classes()).toContain('checked')
  })

  it('toggles modelValue on click', async () => {
    const wrapper = mount(KitCheckbox, {
      props: {
        modelValue: false,
      }
    })
    
    await wrapper.trigger('click')
    
    expect(wrapper.emitted('update:modelValue')).toBeTruthy()
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([true])
    
    // Simulate v-model update
    await wrapper.setProps({ modelValue: true })
    
    await wrapper.trigger('click')
    expect(wrapper.emitted('update:modelValue')?.[1]).toEqual([false])
  })
})
