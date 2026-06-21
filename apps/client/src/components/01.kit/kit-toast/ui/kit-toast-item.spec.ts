import type { ToastMessage } from '~/shared/types/models/toast'
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'
import KitToastItem from './kit-toast-item.vue'

export const mockSwipeState = {
  isSwiping: ref(false),
  direction: ref('none'),
  lengthX: ref(0),
  // eslint-disable-next-line ts/no-unsafe-function-type
  onSwipeEnd: null as Function | null,
}

vi.mock('@vueuse/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@vueuse/core')>()
  return {
    ...actual,
    useSwipe: vi.fn((target, options) => {
      mockSwipeState.onSwipeEnd = options?.onSwipeEnd || null
      return {
        isSwiping: mockSwipeState.isSwiping,
        direction: mockSwipeState.direction,
        lengthX: mockSwipeState.lengthX,
      }
    }),
  }
})

describe('kit-toast-item.vue', () => {
  const defaultMessage: ToastMessage = {
    id: '1',
    type: 'success',
    detail: 'Operation successful',
    title: 'Success',
  } as ToastMessage

  it('renders correctly', () => {
    const wrapper = mount(KitToastItem, {
      props: {
        message: defaultMessage,
      },
    })

    expect(wrapper.text()).toContain('Operation successful')
    expect(wrapper.classes()).toContain('kit-toast-item--success')
  })

  it('renders with different types', () => {
    const message = { ...defaultMessage, type: 'error' } as ToastMessage
    const wrapper = mount(KitToastItem, {
      props: { message },
    })
    expect(wrapper.classes()).toContain('kit-toast-item--error')
  })

  it('emits remove event when close button is clicked', async () => {
    const wrapper = mount(KitToastItem, {
      props: { message: defaultMessage },
    })

    const closeBtn = wrapper.find('.kit-toast-item-close-btn')
    await closeBtn.trigger('click')

    expect(wrapper.emitted('remove')).toBeTruthy()
    expect(wrapper.emitted('remove')).toHaveLength(1)
  })

  it('renders action button if action is provided and handles click', async () => {
    const onClickSpy = vi.fn()
    const messageWithAction = {
      ...defaultMessage,
      action: {
        label: 'Undo',
        onClick: onClickSpy,
      },
    } as ToastMessage

    const wrapper = mount(KitToastItem, {
      props: { message: messageWithAction },
    })

    const actionBtn = wrapper.find('.action-btn')
    expect(actionBtn.exists()).toBe(true)
    expect(actionBtn.text()).toContain('Undo')

    await actionBtn.trigger('click')

    expect(onClickSpy).toHaveBeenCalledOnce()
    expect(wrapper.emitted('remove')).toBeTruthy()
  })

  it('does not render action button if action is not provided', () => {
    const wrapper = mount(KitToastItem, {
      props: { message: defaultMessage },
    })

    const actionBtn = wrapper.find('.action-btn')
    expect(actionBtn.exists()).toBe(false)
  })

  it('swipes to close when swipeToClose is true and swiped far enough', async () => {
    const message = { ...defaultMessage, swipeToClose: true } as ToastMessage
    const wrapper = mount(KitToastItem, {
      props: { message },
    })

    // Simulate swiping
    mockSwipeState.isSwiping.value = true
    mockSwipeState.lengthX.value = -100
    mockSwipeState.direction.value = 'left'
    await nextTick()

    const el = wrapper.find('.kit-toast-item').element as HTMLElement
    expect(el.getAttribute('style')).toContain('transform: translateX(-100px)')

    // End swipe
    if (mockSwipeState.onSwipeEnd) {
      mockSwipeState.onSwipeEnd()
    }

    expect(wrapper.emitted('remove')).toBeTruthy()
  })

  it('does not emit remove if swipe distance is less than threshold', async () => {
    const message = { ...defaultMessage, swipeToClose: true } as ToastMessage
    const wrapper = mount(KitToastItem, {
      props: { message },
    })

    mockSwipeState.isSwiping.value = true
    mockSwipeState.lengthX.value = -40
    mockSwipeState.direction.value = 'left'
    await nextTick()

    if (mockSwipeState.onSwipeEnd) {
      mockSwipeState.onSwipeEnd()
    }

    expect(wrapper.emitted('remove')).toBeFalsy()
  })

  it('does not emit remove if swipe direction is not left or right', async () => {
    const message = { ...defaultMessage, swipeToClose: true } as ToastMessage
    const wrapper = mount(KitToastItem, {
      props: { message },
    })

    mockSwipeState.isSwiping.value = true
    mockSwipeState.lengthX.value = -100
    mockSwipeState.direction.value = 'up'
    await nextTick()

    if (mockSwipeState.onSwipeEnd) {
      mockSwipeState.onSwipeEnd()
    }

    expect(wrapper.emitted('remove')).toBeFalsy()
  })

  it('handleAction does nothing if no action is provided', () => {
    const wrapper = mount(KitToastItem, {
      props: { message: defaultMessage },
    })

    // We try to call handleAction directly if exposed, to cover the branch
    if ('handleAction' in wrapper.vm) {
      ;(wrapper.vm as any).handleAction()
      expect(wrapper.emitted('remove')).toBeFalsy()
    }
  })
})
