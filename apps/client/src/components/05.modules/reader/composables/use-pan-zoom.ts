import type { Ref } from 'vue'
import { onUnmounted, ref, watch } from 'vue'

export function usePanZoom(
  containerRef: Ref<HTMLElement | null>,
  wrapperRef: Ref<HTMLElement | null>,
) {
  const scale = ref(1)
  const panX = ref(0)
  const panY = ref(0)
  const isPanning = ref(false)
  const isPinching = ref(false)
  const dragDist = ref(0)

  const minScale = 1
  const maxScale = 5

  let startPanX = 0
  let startPanY = 0

  let initialPinchDist = 0
  let initialPinchScale = 1
  let initialPinchCenter = { x: 0, y: 0 }

  function resetZoom() {
    scale.value = 1
    panX.value = 0
    panY.value = 0
    isPanning.value = false
    isPinching.value = false
    dragDist.value = 0
  }

  function handleWheel(e: WheelEvent) {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault()
      const zoomSensitivity = 0.005
      const delta = -e.deltaY * zoomSensitivity
      let newScale = scale.value * (1 + delta)
      newScale = Math.min(Math.max(minScale, newScale), maxScale)

      if (wrapperRef.value) {
        const rect = wrapperRef.value.getBoundingClientRect()
        const scaleRatio = newScale / scale.value
        panX.value -= (e.clientX - rect.left) * (scaleRatio - 1)
        panY.value -= (e.clientY - rect.top) * (scaleRatio - 1)
      }

      scale.value = newScale
      if (scale.value === 1) {
        panX.value = 0
        panY.value = 0
      }
    }
    else if (scale.value > 1) {
      e.preventDefault()
      panX.value -= e.deltaX
      panY.value -= e.deltaY
    }
  }

  function handleTouchStart(e: TouchEvent) {
    if (e.touches.length === 2) {
      e.preventDefault()
      isPinching.value = true
      const dx = e.touches[0].clientX - e.touches[1].clientX
      const dy = e.touches[0].clientY - e.touches[1].clientY
      initialPinchDist = Math.sqrt(dx * dx + dy * dy)
      initialPinchScale = scale.value
      initialPinchCenter = {
        x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
        y: (e.touches[0].clientY + e.touches[1].clientY) / 2,
      }
    }
    else if (e.touches.length === 1 && scale.value > 1) {
      isPanning.value = true
      startPanX = e.touches[0].clientX - panX.value
      startPanY = e.touches[0].clientY - panY.value
      dragDist.value = 0
    }
  }

  function handleTouchMove(e: TouchEvent) {
    if (isPinching.value && e.touches.length === 2) {
      e.preventDefault()
      const dx = e.touches[0].clientX - e.touches[1].clientX
      const dy = e.touches[0].clientY - e.touches[1].clientY
      const dist = Math.sqrt(dx * dx + dy * dy)

      let newScale = initialPinchScale * (dist / initialPinchDist)
      newScale = Math.min(Math.max(minScale, newScale), maxScale)

      const currentPinchCenter = {
        x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
        y: (e.touches[0].clientY + e.touches[1].clientY) / 2,
      }

      if (wrapperRef.value) {
        const rect = wrapperRef.value.getBoundingClientRect()
        const scaleRatio = newScale / scale.value
        panX.value -= (currentPinchCenter.x - rect.left) * (scaleRatio - 1)
        panY.value -= (currentPinchCenter.y - rect.top) * (scaleRatio - 1)
      }

      panX.value += (currentPinchCenter.x - initialPinchCenter.x)
      panY.value += (currentPinchCenter.y - initialPinchCenter.y)

      initialPinchCenter = currentPinchCenter
      scale.value = newScale

      if (scale.value === 1) {
        panX.value = 0
        panY.value = 0
      }
    }
    else if (isPanning.value && e.touches.length === 1 && scale.value > 1) {
      e.preventDefault()
      const currentX = e.touches[0].clientX
      const currentY = e.touches[0].clientY
      const newPanX = currentX - startPanX
      const newPanY = currentY - startPanY

      dragDist.value += Math.abs(newPanX - panX.value) + Math.abs(newPanY - panY.value)

      panX.value = newPanX
      panY.value = newPanY
    }
  }

  function handleTouchEnd(e: TouchEvent) {
    if (e.touches.length < 2) {
      isPinching.value = false
    }
    if (e.touches.length === 0) {
      isPanning.value = false
    }
    if (scale.value === 1) {
      panX.value = 0
      panY.value = 0
    }
  }

  function handleMouseDown(e: MouseEvent) {
    if (scale.value > 1) {
      isPanning.value = true
      startPanX = e.clientX - panX.value
      startPanY = e.clientY - panY.value
      dragDist.value = 0
    }
  }

  function handleMouseMove(e: MouseEvent) {
    if (isPanning.value && scale.value > 1) {
      e.preventDefault()
      const newPanX = e.clientX - startPanX
      const newPanY = e.clientY - startPanY
      dragDist.value += Math.abs(newPanX - panX.value) + Math.abs(newPanY - panY.value)

      panX.value = newPanX
      panY.value = newPanY
    }
  }

  function handleMouseUp() {
    if (isPanning.value) {
      isPanning.value = false
    }
  }

  function attachListeners(el: HTMLElement) {
    el.addEventListener('wheel', handleWheel, { passive: false })
    el.addEventListener('touchstart', handleTouchStart, { passive: false })
    el.addEventListener('touchmove', handleTouchMove, { passive: false })
    el.addEventListener('touchend', handleTouchEnd)
    el.addEventListener('touchcancel', handleTouchEnd)

    el.addEventListener('mousedown', handleMouseDown)
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
  }

  function detachListeners(el: HTMLElement) {
    el.removeEventListener('wheel', handleWheel)
    el.removeEventListener('touchstart', handleTouchStart)
    el.removeEventListener('touchmove', handleTouchMove)
    el.removeEventListener('touchend', handleTouchEnd)
    el.removeEventListener('touchcancel', handleTouchEnd)

    el.removeEventListener('mousedown', handleMouseDown)
    window.removeEventListener('mousemove', handleMouseMove)
    window.removeEventListener('mouseup', handleMouseUp)
  }

  watch(containerRef, (el, oldEl) => {
    if (oldEl)
      detachListeners(oldEl)
    if (el)
      attachListeners(el)
  })

  onUnmounted(() => {
    if (containerRef.value)
      detachListeners(containerRef.value)
    window.removeEventListener('mousemove', handleMouseMove)
    window.removeEventListener('mouseup', handleMouseUp)
  })

  return {
    scale,
    panX,
    panY,
    isPanning,
    isPinching,
    dragDist,
    resetZoom,
  }
}
