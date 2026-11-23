import { computed, ref } from 'vue'

const MIN_SCALE = 0.45
const MAX_SCALE = 1.85
const SCALE_STEP = 0.15

interface CanvasPointer {
  x: number
  y: number
  canPan: boolean
}

function getPinch(points: Map<number, CanvasPointer>) {
  const [first, second] = points.values()

  return {
    x: (first.x + second.x) / 2,
    y: (first.y + second.y) / 2,
    distance: Math.hypot(first.x - second.x, first.y - second.y),
  }
}

export function useCanvasViewport() {
  const panX = ref(0)
  const panY = ref(0)
  const scale = ref(1)
  const isPanning = ref(false)
  const isFullscreen = ref(false)

  const pointers = new Map<number, CanvasPointer>()
  let suppressPointerClick = false

  const stageTransformStyle = computed(() => ({
    transform: `translate3d(${panX.value}px, ${panY.value}px, 0) scale(${scale.value})`,
  }))

  const zoomPercentage = computed(() => `${Math.round(scale.value * 100)}%`)

  function clampScale(next: number): number {
    return Math.min(MAX_SCALE, Math.max(MIN_SCALE, next))
  }

  function zoomIn(): void {
    scale.value = clampScale(scale.value + SCALE_STEP)
  }

  function zoomOut(): void {
    scale.value = clampScale(scale.value - SCALE_STEP)
  }

  function resetViewport(): void {
    panX.value = 0
    panY.value = 0
    scale.value = 1
  }

  function toggleFullscreen(): void {
    isFullscreen.value = !isFullscreen.value
  }

  function canTrackPointer(event: PointerEvent): boolean {
    return event.button === 0 && pointers.size < 2 && (!pointers.size || event.pointerType === 'touch')
  }

  function onPointerDown(event: PointerEvent): void {
    if (!canTrackPointer(event))
      return

    if (pointers.size === 0)
      suppressPointerClick = false

    const target = event.target as Element | null
    const canPan = !target?.closest('[data-canvas-interactive="true"]')

    if (!canPan && event.pointerType !== 'touch')
      return

    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY, canPan })
    isPanning.value = canPan || pointers.size === 2

    if (pointers.size === 2)
      suppressPointerClick = true

    if (canPan)
      (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
  }

  function onPointerMove(event: PointerEvent): void {
    const pointer = pointers.get(event.pointerId)

    if (!pointer)
      return

    if (pointers.size === 2) {
      const previous = getPinch(pointers)
      pointer.x = event.clientX
      pointer.y = event.clientY
      const next = getPinch(pointers)
      const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
      const nextScale = previous.distance > 0 ? clampScale(scale.value * next.distance / previous.distance) : scale.value
      const ratio = nextScale / scale.value

      panX.value = next.x - rect.left - (previous.x - rect.left - panX.value) * ratio
      panY.value = next.y - rect.top - (previous.y - rect.top - panY.value) * ratio
      scale.value = nextScale

      return
    }

    if (pointer.canPan) {
      panX.value += event.clientX - pointer.x
      panY.value += event.clientY - pointer.y
    }

    pointer.x = event.clientX
    pointer.y = event.clientY
  }

  function onPointerUp(event: PointerEvent): void {
    if (!pointers.delete(event.pointerId))
      return

    isPanning.value = [...pointers.values()].some(pointer => pointer.canPan)
  }

  function onClickCapture(event: MouseEvent): void {
    if (suppressPointerClick && event.detail > 0) {
      event.preventDefault()
      event.stopPropagation()
    }
  }

  function onWheel(event: WheelEvent): void {
    if (!event.ctrlKey && !event.metaKey) {
      return
    }

    event.preventDefault()
    const delta = event.deltaY < 0 ? 0.08 : -0.08
    scale.value = clampScale(scale.value + delta)
  }

  return {
    panX,
    panY,
    scale,
    isPanning,
    isFullscreen,
    stageTransformStyle,
    zoomPercentage,
    zoomIn,
    zoomOut,
    resetViewport,
    toggleFullscreen,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onClickCapture,
    onWheel,
  }
}
