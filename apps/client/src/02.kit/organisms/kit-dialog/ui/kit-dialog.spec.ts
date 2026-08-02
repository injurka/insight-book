/* eslint-disable no-restricted-globals */
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import KitDialog from './kit-dialog.vue'

// Mock dependencies
vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}))

vi.mock('@vueuse/core', async (importOriginal) => {
  const actual = await importOriginal<any>()

  return {
    ...actual,
    useDraggable: () => ({
      x: { value: 0 },
      y: { value: 0 },
      style: { value: '' },
    }),
  }
})

vi.mock('../composables/use-dialog-history', () => ({
  useDialogHistory: vi.fn(),
}))

vi.mock('../composables/use-dialog-resize', () => ({
  useDialogResize: () => ({
    dialogWidth: { value: 700 },
    dialogHeight: { value: 'auto' },
    hasResized: { value: false },
    startResize: vi.fn(),
    resetResize: vi.fn(),
  }),
}))

vi.mock('../composables/use-dialog-swipe', () => ({
  useDialogSwipe: () => ({
    isMobile: { value: false },
    isSwiping: { value: false },
    direction: { value: 'down' },
    swipeOffset: { value: 0 },
  }),
}))

describe('kit-dialog.vue', () => {
  const createWrapper = (props = {}, slots = {}) => {
    return mount(KitDialog, {
      props: {
        visible: true,
        ...props,
      },
      slots,
      global: {
        stubs: {
          Teleport: true,
          Transition: true,
          Icon: true,
          DialogResizeHandles: true,
        },
      },
    })
  }

  it('renders correctly when visible is true', () => {
    const wrapper = createWrapper({ title: 'Test Title' })
    expect(wrapper.find('.dialog-root').exists()).toBe(true)
    expect(wrapper.html()).toContain('Test Title')
  })

  it('does not render when visible is false', () => {
    const wrapper = createWrapper({ visible: false })
    expect(wrapper.find('.dialog-root').exists()).toBe(false)
  })

  it('emits update:visible when close button is clicked', async () => {
    const wrapper = createWrapper()
    const closeBtn = wrapper.find('.close-button')
    await closeBtn.trigger('click')

    expect(wrapper.emitted('update:visible')).toBeTruthy()
    expect(wrapper.emitted('update:visible')?.[0]).toEqual([false])
  })

  it('renders default slot content', () => {
    const wrapper = createWrapper({}, { default: '<div class="test-slot">Slot Content</div>' })
    expect(wrapper.find('.test-slot').exists()).toBe(true)
    expect(wrapper.html()).toContain('Slot Content')
  })

  it('closes on overlay click if not persistent', async () => {
    const wrapper = createWrapper({ persistent: false })
    const overlay = wrapper.find('.dialog-overlay')
    await overlay.trigger('mousedown', { offsetX: 0, offsetY: 0 })
    expect(wrapper.emitted('update:visible')?.[0]).toEqual([false])
  })

  it('does not close on overlay click if persistent', async () => {
    const wrapper = createWrapper({ persistent: true })
    const overlay = wrapper.find('.dialog-overlay')
    await overlay.trigger('mousedown', { offsetX: 0, offsetY: 0 })
    expect(wrapper.emitted('update:visible')).toBeFalsy()
  })

  it('can be minimized and expanded', async () => {
    const wrapper = createWrapper({ minimizable: true, title: 'Min test' })
    const minBtn = wrapper.find('.minimize-button')
    await minBtn.trigger('click')

    // The dialog should be hidden via v-show
    const root = wrapper.find('.dialog-root')
    expect(root.attributes('style')).toContain('display: none')

    // The FAB should appear
    const fab = wrapper.find('.dialog-minimized-fab')
    expect(fab.exists()).toBe(true)

    // Expand again
    await fab.trigger('click')
    expect(root.attributes('style') || '').not.toContain('display: none')
    expect(wrapper.find('.dialog-minimized-fab').exists()).toBe(false)
  })

  it('closes on escape key if not persistent', async () => {
    const wrapper = createWrapper({ persistent: false })

    const event = new KeyboardEvent('keydown', { key: 'Escape' })
    document.dispatchEvent(event)

    expect(wrapper.emitted('update:visible')?.[0]).toEqual([false])
  })

  it('does not close on escape key if persistent', async () => {
    const wrapper = createWrapper({ persistent: true })

    const event = new KeyboardEvent('keydown', { key: 'Escape' })
    document.dispatchEvent(event)

    expect(wrapper.emitted('update:visible')).toBeFalsy()
  })

  it('does not close when clicking overlay but outside its actual bounds', async () => {
    const wrapper = createWrapper({ persistent: false })
    const overlay = wrapper.find('.dialog-overlay')
    // Provide offset greater than target size
    Object.defineProperty(overlay.element, 'clientWidth', { value: 100 })
    Object.defineProperty(overlay.element, 'clientHeight', { value: 100 })
    await overlay.trigger('mousedown', { offsetX: 150, offsetY: 150 })
    expect(wrapper.emitted('update:visible')).toBeFalsy()
  })

  it('reacts to keyTrigger to unminimize', async () => {
    const wrapper = createWrapper({ minimizable: true, keyTrigger: 1 })
    wrapper.vm.isMinimized = true
    await wrapper.setProps({ keyTrigger: 2 })
    expect(wrapper.vm.isMinimized).toBe(false)
  })

  it('unmounts and cleans up properly', () => {
    const wrapper = createWrapper()
    const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener')
    const removePropertySpy = vi.spyOn(document.body.style, 'removeProperty')

    wrapper.unmount()

    expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function))
    expect(removePropertySpy).toHaveBeenCalledWith('overflow')
  })

  it('handles watch when window is undefined', async () => {
    const wrapper = createWrapper()
    const originalWindow = global.window
    delete global.window

    // Trigger the watch
    await wrapper.setProps({ floating: true })

    // It should not throw and just return
    global.window = originalWindow
  })
})
