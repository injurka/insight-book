import type { Ref } from 'vue'
import { useResizeObserver } from '@vueuse/core'
import { useReaderStore } from '../store/reader.store'

export function useParallelSync(readerViewRef: Ref<HTMLElement | null>, restoreScrollPosition: () => void) {
  const readerStore = useReaderStore()
  let rafId: number | null = null

  function syncHeights() {
    if (rafId !== null)
      cancelAnimationFrame(rafId)

    rafId = requestAnimationFrame(() => {
      rafId = null

      const leftPane = readerViewRef.value?.querySelector('.left-pane')
      const rightPane = readerViewRef.value?.querySelector('.right-pane')

      if (!leftPane || !rightPane)
        return

      const selectors = 'p, h1, h2, h3, h4, h5, h6, blockquote, li, img'

      const getNodes = (pane: Element): HTMLElement[] => {
        const all = Array.from(pane.querySelectorAll(selectors)) as HTMLElement[]
        return all.filter(el => el.querySelectorAll(selectors).length === 0)
      }

      const leftNodes = getNodes(leftPane)
      const rightNodes = getNodes(rightPane)

      // Phase 1: Reset styles in batch
      for (let i = 0; i < leftNodes.length; i++)
        leftNodes[i].style.minHeight = ''

      for (let i = 0; i < rightNodes.length; i++)
        rightNodes[i].style.minHeight = ''

      if (!readerStore.isParallelView)
        return

      const leftRect = leftPane.getBoundingClientRect()
      const rightRect = rightPane.getBoundingClientRect()
      if (Math.abs(leftRect.top - rightRect.top) > 10)
        return

      const minLen = Math.min(leftNodes.length, rightNodes.length)
      const heights = Array.from<number>({ length: minLen })

      // Phase 2: Measure heights in single batch (Read phase)
      for (let i = 0; i < minLen; i++) {
        const leftHeight = leftNodes[i].getBoundingClientRect().height
        const rightHeight = rightNodes[i].getBoundingClientRect().height
        heights[i] = Math.max(leftHeight, rightHeight)
      }

      // Phase 3: Apply calculated heights in next frame (Write phase)
      requestAnimationFrame(() => {
        for (let i = 0; i < minLen; i++) {
          if (heights[i] > 0) {
            if (leftNodes[i])
              leftNodes[i].style.minHeight = `${heights[i]}px`
            if (rightNodes[i])
              rightNodes[i].style.minHeight = `${heights[i]}px`
          }
        }
      })
    })
  }

  function performLayoutSync() {
    if (readerStore.isParallelView)
      syncHeights()

    restoreScrollPosition()
  }

  useResizeObserver(readerViewRef, () => {
    if (readerStore.isParallelView && !readerStore.isPageLoading)
      syncHeights()
  })

  return {
    performLayoutSync,
  }
}
