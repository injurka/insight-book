/* eslint-disable no-restricted-globals */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'
import { useDialogHistory } from './use-dialog-history'

describe('use-dialog-history', () => {
  let originalWindow: Window
  let addEventListenerSpy: unknown
  let removeEventListenerSpy: unknown
  let pushStateSpy: unknown
  let backSpy: unknown

  beforeEach(() => {
    originalWindow = global.window

    addEventListenerSpy = vi.fn()
    removeEventListenerSpy = vi.fn()
    pushStateSpy = vi.fn()
    backSpy = vi.fn()

    global.window = {
      history: {
        state: null,
        pushState: pushStateSpy,
        back: backSpy,
      },
      addEventListener: addEventListenerSpy,
      removeEventListener: removeEventListenerSpy,
    }
  })

  afterEach(() => {
    global.window = originalWindow
    vi.clearAllMocks()
    vi.useRealTimers()
  })

  it('adds to history and listens to popstate when visible becomes true', async () => {
    const visible = ref(false)
    useDialogHistory('dialog-1', visible)
    await nextTick()
    expect(pushStateSpy).not.toHaveBeenCalled()

    visible.value = true
    await nextTick()

    expect(pushStateSpy).toHaveBeenCalledWith({ isModal: true, dialogId: 'dialog-1' }, '')
    expect(addEventListenerSpy).toHaveBeenCalledWith('popstate', expect.any(Function))
  })

  it('cleans up history on visible = false', async () => {
    vi.useFakeTimers()
    const visible = ref(true)

    global.window.history.state = { dialogId: 'dialog-1' }

    useDialogHistory('dialog-1', visible)
    await nextTick()

    visible.value = false
    await nextTick()

    expect(removeEventListenerSpy).toHaveBeenCalledWith('popstate', expect.any(Function))
    expect(backSpy).toHaveBeenCalled()

    // Simulate popstate during programmatic back
    const popstateHandler = addEventListenerSpy.mock.calls.find((c: unknown) => c[0] === 'popstate')[1]
    if (popstateHandler)
      popstateHandler() // Should return early due to isProgrammaticBack

    vi.advanceTimersByTime(100) // handle setTimeout
  })

  it('closes dialog on popstate if it is the top of the stack', async () => {
    const visible1 = ref(true)
    useDialogHistory('dialog-pop-1', visible1)
    await nextTick()

    const visible2 = ref(true)
    useDialogHistory('dialog-pop-2', visible2)
    await nextTick()

    const popstateHandlers = addEventListenerSpy.mock.calls
      .filter((c: unknown) => c[0] === 'popstate')
      .map((c: unknown) => c[1])

    // Trigger popstate
    // eslint-disable-next-line ts/no-unsafe-function-type
    popstateHandlers.forEach((handler: Function) => handler())
    await nextTick()

    // Only the top one should be closed
    expect(visible2.value).toBe(false)
    expect(visible1.value).toBe(true)
  })

  it('handles undefined window gracefully', async () => {
    global.window = undefined
    const visible = ref(true)
    expect(() => {
      useDialogHistory('dialog-nowindow', visible)
    }).not.toThrow()
    visible.value = false
    await nextTick()

    // Test cleanup when window is undefined
    const visible2 = ref(true)
    useDialogHistory('dialog-nowindow2', visible2)
    await nextTick()

    global.window = undefined
    visible2.value = false // Trigger cleanupHistory when window is undefined
    await nextTick()
  })

  it('calls cleanupHistory on unmounted', async () => {
    const { defineComponent } = await import('vue')
    const { mount } = await import('@vue/test-utils')

    const visible = ref(true)
    const TestComp = defineComponent({
      setup() {
        useDialogHistory('dialog-unmount', visible)

        return () => null
      },
    })

    const wrapper = mount(TestComp)
    await nextTick()

    wrapper.unmount()
    expect(removeEventListenerSpy).toHaveBeenCalledWith('popstate', expect.any(Function))
  })
})
