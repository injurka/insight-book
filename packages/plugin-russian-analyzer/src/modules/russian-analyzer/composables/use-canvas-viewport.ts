import { computed, ref } from 'vue'

const MIN_SCALE = 0.45
const MAX_SCALE = 1.85
const SCALE_STEP = 0.15

export function useCanvasViewport() {
  const panX = ref(0)
  const panY = ref(0)
  const scale = ref(1)
  const isPanning = ref(false)
  const isFullscreen = ref(false)

  let startClientX = 0
  let startClientY = 0
  let originPanX = 0
  let originPanY = 0

  const stageTransformStyle = computed(() => ({
    transform: `translate3d(${panX.value}px, ${panY.value}px, 0) scale(${scale.value})`,
  }))

  const zoomPercentage = computed(() => `${Math.round(scale.value * 100)}%`)

  function clampScale(next: number): number {
    return Math.min(MAX_SCALE, Math.max(MIN_SCALE, Number(next.toFixed(2))))
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

  function onPointerDown(event: PointerEvent): void {
    const target = event.target as HTMLElement | null

    if (target?.closest('[data-canvas-interactive="true"]')) {
      return
    }

    isPanning.value = true
    startClientX = event.clientX
    startClientY = event.clientY
    originPanX = panX.value
    originPanY = panY.value
  }

  function onPointerMove(event: PointerEvent): void {
    if (!isPanning.value) {
      return
    }

    panX.value = originPanX + (event.clientX - startClientX)
    panY.value = originPanY + (event.clientY - startClientY)
  }

  function onPointerUp(): void {
    isPanning.value = false
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
    onWheel,
  }
}
