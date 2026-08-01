import type { Ref } from 'vue'
import { ref } from 'vue'

interface UseDialogResizeOptions {
  dialogContentRef: Ref<HTMLElement | null>
  x: Ref<number>
  y: Ref<number>
  isFloating: Ref<boolean>
  isResizable: Ref<boolean>
}

export function useDialogResize({
  dialogContentRef,
  x,
  y,
  isFloating,
  isResizable,
}: UseDialogResizeOptions) {
  const dialogWidth = ref<number | '100%'>('100%')
  const dialogHeight = ref<number | 'auto'>('auto')
  const hasResized = ref(false)

  let isResizing = false
  let currentHandle = ''
  let startX = 0
  let startY = 0
  let startWidth = 0
  let startHeight = 0
  let startPosX = 0
  let startPosY = 0
  let resizeRaf: number | null = null

  function startResize(handle: string, e: MouseEvent) {
    if (!isResizable.value)
      return

    isResizing = true
    currentHandle = handle
    startX = e.clientX
    startY = e.clientY

    if (dialogContentRef.value) {
      const rect = dialogContentRef.value.getBoundingClientRect()
      startWidth = rect.width
      startHeight = rect.height

      dialogWidth.value = startWidth
      dialogHeight.value = startHeight
    }

    hasResized.value = true

    startPosX = x.value
    startPosY = y.value

    document.addEventListener('mousemove', onResize)
    document.addEventListener('mouseup', stopResize)
    document.body.style.userSelect = 'none'
  }

  function calculateResizedBounds(dx: number, dy: number) {
    let newWidth = startWidth
    let newHeight = startHeight
    let newX = startPosX
    let newY = startPosY

    if (isFloating.value) {
      if (currentHandle.includes('right'))
        newWidth = startWidth + dx
      if (currentHandle.includes('left')) {
        newWidth = startWidth - dx
        newX = startPosX + dx
      }
      if (currentHandle.includes('bottom'))
        newHeight = startHeight + dy
      if (currentHandle.includes('top')) {
        newHeight = startHeight - dy
        newY = startPosY + dy
      }
    }
    else {
      if (currentHandle.includes('right'))
        newWidth = startWidth + dx * 2
      if (currentHandle.includes('left'))
        newWidth = startWidth - dx * 2
      if (currentHandle.includes('bottom'))
        newHeight = startHeight + dy * 2
      if (currentHandle.includes('top'))
        newHeight = startHeight - dy * 2
    }

    return { newWidth, newHeight, newX, newY }
  }

  function onResize(e: MouseEvent) {
    if (!isResizing || !isResizable.value)
      return

    if (resizeRaf)
      cancelAnimationFrame(resizeRaf)

    resizeRaf = requestAnimationFrame(() => {
      const dx = e.clientX - startX
      const dy = e.clientY - startY

      let { newWidth, newHeight, newX, newY } = calculateResizedBounds(dx, dy)

      const MIN_W = 300
      const MIN_H = 200

      if (newWidth < MIN_W) {
        if (isFloating.value && currentHandle.includes('left'))
          newX -= (MIN_W - newWidth)
        newWidth = MIN_W
      }
      if (newHeight < MIN_H) {
        if (isFloating.value && currentHandle.includes('top'))
          newY -= (MIN_H - newHeight)
        newHeight = MIN_H
      }

      dialogWidth.value = newWidth
      dialogHeight.value = newHeight

      if (isFloating.value) {
        x.value = newX
        y.value = newY
      }
    })
  }

  function stopResize() {
    isResizing = false
    if (resizeRaf)
      cancelAnimationFrame(resizeRaf)
    document.removeEventListener('mousemove', onResize)
    document.removeEventListener('mouseup', stopResize)
    document.body.style.userSelect = ''
  }

  function resetResize() {
    hasResized.value = false
    dialogWidth.value = '100%'
    dialogHeight.value = 'auto'
  }

  return {
    dialogWidth,
    dialogHeight,
    hasResized,
    startResize,
    resetResize,
  }
}
