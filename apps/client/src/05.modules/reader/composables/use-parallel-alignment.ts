import type { Ref } from 'vue'
import { onBeforeUnmount, onMounted, watch } from 'vue'

/** Match logical sentence heights without replacing selectable book markup. */
export function useParallelAlignment(
  root: Ref<HTMLElement | null>,
  enabled: () => boolean,
  content: Ref<string>[],
  typography: () => unknown,
) {
  let observer: ResizeObserver | undefined
  let frame = 0

  function align() {
    const left = root.value?.querySelector<HTMLElement>('.left-pane')
    const right = root.value?.querySelector<HTMLElement>('.right-pane')
    const rows = [...(root.value?.querySelectorAll<HTMLElement>('.parallel-sentence') || [])]
    rows.forEach(row => row.style.removeProperty('min-height'))

    if (!enabled() || !left || !right || Math.abs(left.getBoundingClientRect().left - right.getBoundingClientRect().left) < 1)
      return

    const rightRows = new Map([...right.querySelectorAll<HTMLElement>('.parallel-sentence')]
      .map(row => [row.dataset.parallelId, row]))
    const pairs = [...left.querySelectorAll<HTMLElement>('.parallel-sentence')]
      .map(row => ({ left: row, right: rightRows.get(row.dataset.parallelId) }))
      .filter((pair): pair is { left: HTMLElement, right: HTMLElement } => Boolean(pair.right))
    // Read all natural heights before writing, avoiding repeated layout per sentence.
    const heights = pairs.map(pair => Math.max(pair.left.getBoundingClientRect().height, pair.right.getBoundingClientRect().height))
    pairs.forEach((pair, index) => {
      pair.left.style.minHeight = `${heights[index]}px`
      pair.right.style.minHeight = `${heights[index]}px`
    })
  }

  function schedule() {
    cancelAnimationFrame(frame)
    frame = requestAnimationFrame(align)
  }

  watch([...content, enabled, typography], schedule, { flush: 'post' })
  onMounted(() => {
    observer = new ResizeObserver(schedule)

    if (root.value)
      observer.observe(root.value)

    document.fonts?.addEventListener('loadingdone', schedule)
    schedule()
  })
  onBeforeUnmount(() => {
    observer?.disconnect()
    cancelAnimationFrame(frame)
    document.fonts?.removeEventListener('loadingdone', schedule)
  })
}
