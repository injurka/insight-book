import { nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { placeFloatingAnalysis } from '../lib/floating-analysis-placement'

export function useFloatingAnalysisLayout(readerView: () => HTMLElement | null, isOpen: () => boolean, layoutKey: () => string) {
  const floating = ref(false)
  const offset = ref(0)
  const dialogPosition = ref<{ x: number } | null>(null)
  let observer: ResizeObserver | null = null
  let dragged = false

  function measure(draggedX?: number) {
    const view = readerView()
    const layout = view?.querySelector<HTMLElement>('.reader-content-layout')
    const dialog = document.querySelector<HTMLElement>('.sentence-analysis-dialog.is-floating')

    if (!view || !layout || !dialog || !isOpen() || !floating.value)
      return null

    const bounds = view.getBoundingClientRect()
    const content = layout.getBoundingClientRect()
    const dialogRect = dialog.getBoundingClientRect()

    return placeFloatingAnalysis({
      left: bounds.left,
      width: bounds.width,
      contentWidth: content.width,
      dialogWidth: dialogRect.width,
      draggedX: dragged ? (draggedX ?? dialogRect.left) : undefined,
    })
  }

  function update(draggedX?: number) {
    const placement = measure(draggedX)

    if (!placement) {
      offset.value = 0
      dialogPosition.value = null

      return
    }

    offset.value = placement.offset

    if (draggedX !== undefined || dialogPosition.value?.x !== placement.x)
      dialogPosition.value = { x: placement.x }
  }

  function onDragEnd(x: number) {
    dragged = true
    update(x)
  }

  async function observe() {
    observer?.disconnect()
    await nextTick()

    if (!floating.value || !isOpen())
      dragged = false

    update()

    if (!floating.value || !isOpen())
      return

    const layout = readerView()?.querySelector<HTMLElement>('.reader-content-layout')
    const dialog = document.querySelector<HTMLElement>('.sentence-analysis-dialog.is-floating')

    if (!layout || !dialog)
      return

    observer = new ResizeObserver(() => update())
    observer.observe(layout)
    observer.observe(dialog)
  }

  watch([floating, isOpen, layoutKey], observe, { flush: 'post' })
  const onResize = () => update()
  onMounted(() => window.addEventListener('resize', onResize))
  onUnmounted(() => {
    observer?.disconnect()
    window.removeEventListener('resize', onResize)
  })

  return { floating, offset, dialogPosition, onDragEnd }
}
