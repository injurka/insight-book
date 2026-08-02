import type { ViewSwitcherItem } from '../models/types'
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import KitViewSwitcher from './kit-view-switcher.vue'

let resizeCallback: (() => void) | null = null
vi.mock('@vueuse/core', () => ({
  useResizeObserver: vi.fn((target, cb) => {
    resizeCallback = cb
  }),
}))

const defaultItems: ViewSwitcherItem<string>[] = [
  { id: 'view1', label: 'View 1', icon: 'mdi:home' },
  { id: 'view2', label: 'View 2' },
]

describe('kit-view-switcher', () => {
  it('renders items correctly', () => {
    const wrapper = mount(KitViewSwitcher, {
      props: {
        modelValue: 'view1',
        items: defaultItems,
      },
    })

    const buttons = wrapper.findAll('.kit-view-switcher-button')
    expect(buttons).toHaveLength(2)

    expect(buttons[0].text()).toContain('View 1')
    expect(buttons[0].classes()).toContain('is-active')

    expect(buttons[1].text()).toContain('View 2')
    expect(buttons[1].classes()).not.toContain('is-active')
  })

  it('updates model and emits change event on item click', async () => {
    const wrapper = mount(KitViewSwitcher, {
      props: {
        'modelValue': 'view1',
        'onUpdate:modelValue': async (e: string) => wrapper.setProps({ modelValue: e }),
        'items': defaultItems,
      },
    })

    const buttons = wrapper.findAll('.kit-view-switcher-button')

    // Click the second item
    await buttons[1].trigger('click')

    expect(wrapper.props('modelValue')).toBe('view2')
    expect(wrapper.emitted('change')).toBeTruthy()
    expect(wrapper.emitted('change')?.[0]).toEqual(['view2'])
  })

  it('applies disabled state to container and buttons', () => {
    const wrapper = mount(KitViewSwitcher, {
      props: {
        modelValue: 'view1',
        items: defaultItems,
        disabled: true,
      },
    })

    expect(wrapper.classes()).toContain('is-disabled')
    const buttons = wrapper.findAll('.kit-view-switcher-button')

    buttons.forEach((button) => {
      // Vue test utils returns '' for boolean attributes that are present
      expect(button.attributes('disabled')).toBe('')
    })
  })

  it('does not emit events when disabled', async () => {
    const wrapper = mount(KitViewSwitcher, {
      props: {
        modelValue: 'view1',
        items: defaultItems,
        disabled: true,
      },
    })

    const buttons = wrapper.findAll('.kit-view-switcher-button')
    // Remove disabled attribute to force click event to be handled by Vue
    buttons[1].element.removeAttribute('disabled')
    await buttons[1].trigger('click')

    expect(wrapper.emitted('change')).toBeUndefined()
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })

  it('handles unknown modelValue gracefully', async () => {
    const wrapper = mount(KitViewSwitcher, {
      props: {
        modelValue: 'unknown',
        items: defaultItems,
      },
    })

    await wrapper.vm.$nextTick()
  })

  it('handles resize observer callback', () => {
    mount(KitViewSwitcher, {
      props: {
        modelValue: 'view1',
        items: defaultItems,
      },
    })

    if (resizeCallback)
      resizeCallback()
  })

  it('handles updateGliderPosition when switcherEl is null', () => {
    const wrapper = mount(KitViewSwitcher, {
      props: {
        modelValue: 'view1',
        items: defaultItems,
      },
    })

    wrapper.unmount()
    if (resizeCallback)
      resizeCallback()
  })

  it('sets transition after mount via setTimeout', async () => {
    vi.useFakeTimers()
    const wrapper = mount(KitViewSwitcher, {
      props: {
        modelValue: 'view1',
        items: defaultItems,
      },
    })
    await wrapper.vm.$nextTick()
    vi.runAllTimers()
    vi.useRealTimers()
  })

  it('applies full-width class', () => {
    const wrapper = mount(KitViewSwitcher, {
      props: {
        modelValue: 'view1',
        items: defaultItems,
        fullWidth: true,
      },
    })

    expect(wrapper.classes()).toContain('is-full-width')
  })
})
