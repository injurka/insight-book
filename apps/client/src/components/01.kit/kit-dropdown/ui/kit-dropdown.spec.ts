import { enableAutoUnmount, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import KitDropdown from './kit-dropdown.vue'

enableAutoUnmount(afterEach)

describe('kitDropdown', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('renders correctly', () => {
    const wrapper = mount(KitDropdown, {
      slots: {
        activator: '<button class="activator-btn">Toggle</button>',
        default: '<div class="content">Content</div>',
      },
    })

    expect(wrapper.exists()).toBe(true)
    expect(wrapper.find('.activator-btn').exists()).toBe(true)
  })

  it('toggles dropdown on activator click', async () => {
    const wrapper = mount(KitDropdown, {
      slots: {
        activator: '<button class="activator-btn">Toggle</button>',
        default: '<div class="content">Content</div>',
      },
    })

    // Initially closed
    expect(document.querySelector('.dropdown-menu')).toBeNull()

    // Click activator
    await wrapper.find('.dropdown-trigger').trigger('click')
    expect(document.querySelector('.dropdown-menu')).not.toBeNull()
    expect(document.querySelector('.content')).not.toBeNull()

    // Click again to close
    await wrapper.find('.dropdown-trigger').trigger('click')
    await nextTick()
    expect(document.querySelector('.dropdown-menu')).toBeNull()
  })

  it('supports v-model', async () => {
    const wrapper = mount(KitDropdown, {
      props: {
        'modelValue': true,
        'onUpdate:modelValue': (e: boolean) => wrapper.setProps({ modelValue: e }),
      },
      slots: {
        default: '<div class="content">Content</div>',
      },
    })

    expect(document.querySelector('.dropdown-menu')).not.toBeNull()

    await wrapper.setProps({ modelValue: false })
    await nextTick()
    expect(document.querySelector('.dropdown-menu')).toBeNull()
  })

  it('closes on content click by default', async () => {
    const wrapper = mount(KitDropdown, {
      slots: {
        default: '<div class="content">Content</div>',
      },
    })

    await wrapper.find('.dropdown-trigger').trigger('click')

    const menu = document.querySelector('.dropdown-menu')
    expect(menu).not.toBeNull()

    menu?.dispatchEvent(new MouseEvent('click', { bubbles: true }))

    await nextTick()
    expect(document.querySelector('.dropdown-menu')).toBeNull()
  })

  it('does not close on content click if closeOnContentClick is false', async () => {
    const wrapper = mount(KitDropdown, {
      props: {
        closeOnContentClick: false,
      },
      slots: {
        default: '<div class="content">Content</div>',
      },
    })

    await wrapper.find('.dropdown-trigger').trigger('click')

    const menu = document.querySelector('.dropdown-menu')
    expect(menu).not.toBeNull()

    menu?.dispatchEvent(new MouseEvent('click', { bubbles: true }))

    await nextTick()
    expect(document.querySelector('.dropdown-menu')).not.toBeNull()
  })

  it('closes on Escape key press', async () => {
    const wrapper = mount(KitDropdown)

    await wrapper.find('.dropdown-trigger').trigger('click')
    expect(document.querySelector('.dropdown-menu')).not.toBeNull()

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))

    await nextTick()
    expect(document.querySelector('.dropdown-menu')).toBeNull()
  })

  it('exposes open and close methods', async () => {
    const wrapper = mount(KitDropdown)

    // @ts-expect-error accessing exposed methods
    wrapper.vm.open()
    await nextTick()
    expect(document.querySelector('.dropdown-menu')).not.toBeNull()

    // @ts-expect-error accessing exposed methods
    wrapper.vm.close()
    await nextTick()
    expect(document.querySelector('.dropdown-menu')).toBeNull()
  })

  it('does not close when clicking outside on the reference element', async () => {
    const wrapper = mount(KitDropdown, {
      slots: {
        activator: '<button class="activator-btn">Toggle</button>',
      },
    })

    await wrapper.find('.dropdown-trigger').trigger('click')
    expect(document.querySelector('.dropdown-menu')).not.toBeNull()

    // Dispatch pointerdown on the activator (which is inside referenceRef)
    wrapper.find('.activator-btn').element.dispatchEvent(new Event('pointerdown', { bubbles: true }))

    await nextTick()
    expect(document.querySelector('.dropdown-menu')).not.toBeNull()
  })

  it('closes when clicking outside the dropdown', async () => {
    const wrapper = mount(KitDropdown)

    await wrapper.find('.dropdown-trigger').trigger('click')
    expect(document.querySelector('.dropdown-menu')).not.toBeNull()

    const outside = document.createElement('div')
    document.body.appendChild(outside)
    outside.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    outside.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }))
    outside.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    outside.dispatchEvent(new Event('mousedown', { bubbles: true }))
    outside.dispatchEvent(new MouseEvent('click', { bubbles: true }))

    await nextTick()
    expect(document.querySelector('.dropdown-menu')).toBeNull()
  })

  it('does not close on content click if target is within .kit-select-wrapper', async () => {
    const wrapper = mount(KitDropdown, {
      slots: {
        default: '<div class="kit-select-wrapper"><button class="inner-btn">Click</button></div>',
      },
    })

    await wrapper.find('.dropdown-trigger').trigger('click')

    const menu = document.querySelector('.dropdown-menu')
    expect(menu).not.toBeNull()

    const innerBtn = document.querySelector('.inner-btn')
    innerBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }))

    await nextTick()
    expect(document.querySelector('.dropdown-menu')).not.toBeNull()
  })
})
