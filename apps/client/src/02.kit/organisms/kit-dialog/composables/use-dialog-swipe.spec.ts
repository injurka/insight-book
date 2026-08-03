import * as vueuseCore from '@vueuse/core'
import { describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'
import { useDialogSwipe } from './use-dialog-swipe'

// Mock useSwipe and useMediaQuery
vi.mock('@vueuse/core', async (importOriginal) => {
  const actual = await importOriginal<typeof vueuseCore>()

  return {
    ...actual,
    useMediaQuery: vi.fn(() => ref(true)),
    useSwipe: vi.fn(),
  }
})

describe('use-dialog-swipe', () => {
  it('handles swipe correctly for mobile and non-floating', async () => {
    let swipeEndCb: () => void = () => {}

    const lengthY = ref(0)
    const isSwiping = ref(false)
    const direction = ref('down')

    vueuseCore.useSwipe.mockImplementation((ref, options) => {
      if (options.onSwipeEnd)
        swipeEndCb = options.onSwipeEnd

      return { lengthY, isSwiping, direction }
    })

    const headerRef = ref<HTMLElement | null>(null)
    const visible = ref(true)
    const isMinimized = ref(false)
    const isFloating = ref(false)
    const isMinimizable = ref(true)

    const { swipeOffset, isSnappingBack } = useDialogSwipe({
      headerRef,
      visible,
      isMinimized,
      isFloating,
      isMinimizable,
    })

    // Simulate watch triggering on lengthY change
    isSwiping.value = true
    lengthY.value = -50
    await nextTick()

    expect(swipeOffset.value).toBe(50)
    expect(isSnappingBack.value).toBe(false)

    // Simulate swipe end < 100
    swipeEndCb()
    expect(isSnappingBack.value).toBe(true)
    expect(swipeOffset.value).toBe(0)

    // Simulate swipe end > 100
    isSwiping.value = true
    lengthY.value = -150
    await nextTick()

    expect(swipeOffset.value).toBe(150)

    swipeEndCb()
    expect(isMinimized.value).toBe(true)

    // Simulate non-minimizable closing
    isMinimized.value = false
    isMinimizable.value = false

    isSwiping.value = true
    lengthY.value = -150
    await nextTick()

    swipeEndCb()
    expect(visible.value).toBe(false)
  })

  it('resets offset when visibility changes', async () => {
    vi.useFakeTimers()
    const lengthY = ref(0)
    const isSwiping = ref(false)
    const direction = ref('down')

    vueuseCore.useSwipe.mockImplementation(() => ({ lengthY, isSwiping, direction }))

    const headerRef = ref<HTMLElement | null>(null)
    const visible = ref(true)
    const isMinimized = ref(false)
    const isFloating = ref(false)
    const isMinimizable = ref(true)

    const { swipeOffset } = useDialogSwipe({
      headerRef,
      visible,
      isMinimized,
      isFloating,
      isMinimizable,
    })

    swipeOffset.value = 100
    visible.value = false
    await nextTick()

    vi.advanceTimersByTime(300)
    expect(swipeOffset.value).toBe(0)

    // hit the else branch
    visible.value = true
    await nextTick()
    expect(swipeOffset.value).toBe(0)

    vi.useRealTimers()
  })
})
