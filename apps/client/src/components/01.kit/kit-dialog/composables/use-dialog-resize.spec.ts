import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import { useDialogResize } from './use-dialog-resize'

describe('use-dialog-resize', () => {
  beforeEach(() => {
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      cb(0)
      return 1
    })
    vi.stubGlobal('cancelAnimationFrame', vi.fn())
  })

  it('does not resize if isResizable is false', () => {
    const dialogContentRef = ref<HTMLElement | null>(null)
    const x = ref(0)
    const y = ref(0)
    const isFloating = ref(false)
    const isResizable = ref(false)

    const { startResize, hasResized } = useDialogResize({
      dialogContentRef, x, y, isFloating, isResizable
    })

    startResize('right', new MouseEvent('mousedown'))
    expect(hasResized.value).toBe(false)
  })

  it('ignores mousemove when not resizing', () => {
    const dialogContentRef = ref<HTMLElement | null>(null)
    const x = ref(0)
    const y = ref(0)
    const isFloating = ref(false)
    const isResizable = ref(true)

    const { dialogWidth, dialogHeight } = useDialogResize({
      dialogContentRef, x, y, isFloating, isResizable
    })
    
    // Call mousemove without starting resize
    document.dispatchEvent(new MouseEvent('mousemove', { clientX: 10, clientY: 10 }))
    expect(dialogWidth.value).toBe('100%')
  })

  it('resizes floating dialog', () => {
    const div = document.createElement('div')
    // Mock getBoundingClientRect
    div.getBoundingClientRect = () => ({ width: 400, height: 300 } as DOMRect)
    
    const dialogContentRef = ref<HTMLElement | null>(div)
    const x = ref(100)
    const y = ref(100)
    const isFloating = ref(true)
    const isResizable = ref(true)

    const { startResize, dialogWidth, dialogHeight, hasResized } = useDialogResize({
      dialogContentRef, x, y, isFloating, isResizable
    })

    // start resize bottom right
    const mousedownEvent = new MouseEvent('mousedown', { clientX: 200, clientY: 200 })
    startResize('bottom-right', mousedownEvent)
    
    expect(hasResized.value).toBe(true)
    expect(dialogWidth.value).toBe(400)
    expect(dialogHeight.value).toBe(300)

    // Trigger mousemove
    const mousemoveEvent = new MouseEvent('mousemove', { clientX: 250, clientY: 250 })
    document.dispatchEvent(mousemoveEvent)

    // dx = 50, dy = 50. width: 400 + 50 = 450, height: 300 + 50 = 350
    expect(dialogWidth.value).toBe(450)
    expect(dialogHeight.value).toBe(350)
    
    // Trigger stopResize
    const mouseupEvent = new MouseEvent('mouseup')
    document.dispatchEvent(mouseupEvent)
  })

  it('resizes non-floating dialog from center', () => {
    const div = document.createElement('div')
    div.getBoundingClientRect = () => ({ width: 400, height: 300 } as DOMRect)
    
    const dialogContentRef = ref<HTMLElement | null>(div)
    const x = ref(0)
    const y = ref(0)
    const isFloating = ref(false)
    const isResizable = ref(true)

    const { startResize, dialogWidth, dialogHeight } = useDialogResize({
      dialogContentRef, x, y, isFloating, isResizable
    })

    const mousedownEvent = new MouseEvent('mousedown', { clientX: 200, clientY: 200 })
    startResize('top-left', mousedownEvent)
    
    const mousemoveEvent = new MouseEvent('mousemove', { clientX: 180, clientY: 180 })
    document.dispatchEvent(mousemoveEvent)

    // dx = -20, dy = -20. newWidth = 400 - (-20*2) = 440, newHeight = 300 - (-20*2) = 340
    expect(dialogWidth.value).toBe(440)
    expect(dialogHeight.value).toBe(340)

    // Trigger stopResize
    document.dispatchEvent(new MouseEvent('mouseup'))

    // Test other handles
    startResize('bottom-right', new MouseEvent('mousedown', { clientX: 200, clientY: 200 }))
    document.dispatchEvent(new MouseEvent('mousemove', { clientX: 210, clientY: 210 }))
    // new width = 400 + 10*2 = 420, newHeight = 300 + 10*2 = 320
    expect(dialogWidth.value).toBe(420)
    expect(dialogHeight.value).toBe(320)
    document.dispatchEvent(new MouseEvent('mouseup'))
  })

  it('respects MIN_W and MIN_H limits', () => {
    const div = document.createElement('div')
    div.getBoundingClientRect = () => ({ width: 400, height: 300 } as DOMRect)
    
    const dialogContentRef = ref<HTMLElement | null>(div)
    const x = ref(100)
    const y = ref(100)
    const isFloating = ref(true)
    const isResizable = ref(true)

    const { startResize, dialogWidth, dialogHeight } = useDialogResize({
      dialogContentRef, x, y, isFloating, isResizable
    })

    const mousedownEvent = new MouseEvent('mousedown', { clientX: 200, clientY: 200 })
    startResize('top-left', mousedownEvent)
    
    // move so width goes below 300 (dx > 100) and height below 200 (dy > 100)
    const mousemoveEvent = new MouseEvent('mousemove', { clientX: 350, clientY: 350 }) // dx = 150, dy = 150
    document.dispatchEvent(mousemoveEvent)

    expect(dialogWidth.value).toBe(300) // minimum
    expect(dialogHeight.value).toBe(200) // minimum
  })

  it('can reset resize', () => {
    const dialogContentRef = ref<HTMLElement | null>(null)
    const x = ref(0)
    const y = ref(0)
    const isFloating = ref(false)
    const isResizable = ref(true)

    const { resetResize, dialogWidth, dialogHeight, hasResized } = useDialogResize({
      dialogContentRef, x, y, isFloating, isResizable
    })
    
    hasResized.value = true
    dialogWidth.value = 500
    
    resetResize()
    
    expect(hasResized.value).toBe(false)
    expect(dialogWidth.value).toBe('100%')
    expect(dialogHeight.value).toBe('auto')
  })
})
