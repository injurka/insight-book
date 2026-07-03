import { Icon } from '@iconify/vue'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import KitToggle from './kit-toggle.vue'

const globalConfig = {
  components: {
    Icon,
  },
}

describe('kitToggle', () => {
  const options = [
    { value: 'list', label: 'List view', icon: 'mdi:format-list-bulleted', tooltip: 'Show list' },
    { value: 'grid', label: 'Grid view', icon: 'mdi:view-grid', tooltip: 'Show grid' },
    { value: 'gallery', icon: 'mdi:image-multiple' },
  ]

  it('renders all options as buttons', () => {
    const wrapper = mount(KitToggle, {
      global: globalConfig,
      props: {
        modelValue: 'list',
        options,
      },
    })

    const buttons = wrapper.findAll('.kit-toggle-btn')
    expect(buttons.length).toBe(3)
  })

  it('applies active class to the button matching modelValue', () => {
    const wrapper = mount(KitToggle, {
      global: globalConfig,
      props: {
        modelValue: 'grid',
        options,
      },
    })

    const buttons = wrapper.findAll('.kit-toggle-btn')
    expect(buttons[0].classes()).not.toContain('is-active')
    expect(buttons[1].classes()).toContain('is-active')
    expect(buttons[2].classes()).not.toContain('is-active')
  })

  it('renders icons and labels correctly based on options', () => {
    const wrapper = mount(KitToggle, {
      global: globalConfig,
      props: {
        modelValue: 'list',
        options,
      },
    })

    const buttons = wrapper.findAll('.kit-toggle-btn')

    // First button has both icon and label
    const firstButton = buttons[0]
    expect(firstButton.findComponent(Icon).exists()).toBe(true)
    expect(firstButton.findComponent(Icon).props('icon')).toBe('mdi:format-list-bulleted')
    expect(firstButton.find('.kit-toggle-label').text()).toBe('List view')

    // Third button has icon but no label
    const thirdButton = buttons[2]
    expect(thirdButton.findComponent(Icon).exists()).toBe(true)
    expect(thirdButton.findComponent(Icon).props('icon')).toBe('mdi:image-multiple')
    expect(thirdButton.find('.kit-toggle-label').exists()).toBe(false)
  })

  it('sets title attribute using tooltip or label', () => {
    const customOptions = [
      { value: '1', label: 'One', tooltip: 'First option' },
      { value: '2', label: 'Two' },
    ]

    const wrapper = mount(KitToggle, {
      global: globalConfig,
      props: {
        modelValue: '1',
        options: customOptions,
      },
    })

    const buttons = wrapper.findAll('.kit-toggle-btn')
    expect(buttons[0].attributes('title')).toBe('First option')
    expect(buttons[1].attributes('title')).toBe('Two')
  })

  it('emits update:modelValue event with option value on click', async () => {
    const wrapper = mount(KitToggle, {
      global: globalConfig,
      props: {
        modelValue: 'list',
        options,
      },
    })

    const buttons = wrapper.findAll('.kit-toggle-btn')
    await buttons[1].trigger('click')

    expect(wrapper.emitted('update:modelValue')).toBeTruthy()
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['grid'])
  })

  it('applies default size class (sm)', () => {
    const wrapper = mount(KitToggle, {
      global: globalConfig,
      props: {
        modelValue: 'list',
        options,
      },
    })

    expect(wrapper.classes()).toContain('kit-toggle--size-sm')
  })

  it('applies custom size classes correctly', () => {
    const sizes = ['xs', 'sm', 'md', 'lg'] as const

    sizes.forEach((size) => {
      const wrapper = mount(KitToggle, {
        global: globalConfig,
        props: {
          modelValue: 'list',
          options,
          size,
        },
      })
      expect(wrapper.classes()).toContain(`kit-toggle--size-${size}`)
    })
  })
})
