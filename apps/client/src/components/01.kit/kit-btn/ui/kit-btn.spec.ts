import { Icon } from '@iconify/vue'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import KitBtn from './kit-btn.vue'

// Mock v-ripple directivecle
const vRipple = {
  mounted: () => {},
  unmounted: () => {},
}

const globalConfig = {
  directives: {
    ripple: vRipple,
  },
  components: {
    Icon,
  },
}

describe('kitBtn', () => {
  it('renders default slot content', () => {
    const wrapper = mount(KitBtn, {
      global: globalConfig,
      slots: {
        default: 'Click me',
      },
    })
    expect(wrapper.text()).toContain('Click me')
  })

  it('applies default props correctly', () => {
    const wrapper = mount(KitBtn, {
      global: globalConfig,
    })
    expect(wrapper.classes()).toContain('kit-btn--solid')
    expect(wrapper.classes()).toContain('kit-btn--color-primary')
    expect(wrapper.classes()).toContain('kit-btn--size-md')
    expect(wrapper.classes()).toContain('kit-btn--density-default')
    expect(wrapper.attributes('disabled')).toBeUndefined()
  })

  it('applies custom props correctly', () => {
    const wrapper = mount(KitBtn, {
      global: globalConfig,
      props: {
        variant: 'outlined',
        color: 'secondary',
        size: 'lg',
        density: 'compact',
      },
    })
    expect(wrapper.classes()).toContain('kit-btn--outlined')
    expect(wrapper.classes()).toContain('kit-btn--color-secondary')
    expect(wrapper.classes()).toContain('kit-btn--size-lg')
    expect(wrapper.classes()).toContain('kit-btn--density-compact')
  })

  it('applies disabled state', async () => {
    const wrapper = mount(KitBtn, {
      global: globalConfig,
      props: {
        disabled: true,
      },
    })

    expect(wrapper.attributes('disabled')).toBeDefined()
    expect(wrapper.element.disabled).toBe(true)
  })

  it('renders prependIcon and appendIcon', () => {
    const wrapper = mount(KitBtn, {
      global: globalConfig,
      props: {
        prependIcon: 'mdi:home',
        appendIcon: 'mdi:chevron-right',
      },
      slots: {
        default: 'Home',
      },
    })

    const icons = wrapper.findAllComponents(Icon)
    expect(icons.length).toBe(2)
    expect(icons[0].props('icon')).toBe('mdi:home')
    expect(icons[1].props('icon')).toBe('mdi:chevron-right')
  })

  it('adds icon-only class when only icon prop is provided', () => {
    const wrapper = mount(KitBtn, {
      global: globalConfig,
      props: {
        icon: 'mdi:plus',
      },
    })

    expect(wrapper.classes()).toContain('kit-btn--icon-only')
    const icon = wrapper.findComponent(Icon)
    expect(icon.exists()).toBe(true)
    expect(icon.props('icon')).toBe('mdi:plus')
  })

  it('does not add icon-only class if default slot is provided', () => {
    const wrapper = mount(KitBtn, {
      global: globalConfig,
      props: {
        icon: 'mdi:plus',
      },
      slots: {
        default: 'Add',
      },
    })

    expect(wrapper.classes()).not.toContain('kit-btn--icon-only')
  })

  it('emits native click event when clicked', async () => {
    const wrapper = mount(KitBtn, {
      global: globalConfig,
    })

    await wrapper.trigger('click')
    expect(wrapper.emitted('click')).toBeTruthy()
    expect(wrapper.emitted('click')?.length).toBe(1)
  })
})
