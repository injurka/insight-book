import type { Ref } from 'vue'
import { useResizeObserver } from '@vueuse/core'
import { useReaderStore } from '../store/reader.store'

export function useParallelSync(
  readerViewRef: Ref<HTMLElement | null>,
  restoreScrollPosition: () => void,
) {
  const readerStore = useReaderStore()

  function syncHeights() {
    const leftPane = readerViewRef.value?.querySelector('.left-pane')
    const rightPane = readerViewRef.value?.querySelector('.right-pane')

    if (!leftPane || !rightPane)
      return

    const selectors = 'p, h1, h2, h3, h4, h5, h6, blockquote, li, img'

    const getNodes = (pane: Element) => {
      const all = Array.from(pane.querySelectorAll(selectors)) as HTMLElement[]
      return all.filter(el => el.querySelectorAll(selectors).length === 0)
    }

    const leftNodes = getNodes(leftPane)
    const rightNodes = getNodes(rightPane)

    leftNodes.forEach(el => el.style.minHeight = '')
    rightNodes.forEach(el => el.style.minHeight = '')

    if (!readerStore.isParallelView)
      return

    const leftRect = leftPane.getBoundingClientRect()
    const rightRect = rightPane.getBoundingClientRect()
    if (Math.abs(leftRect.top - rightRect.top) > 10)
      return

    const minLen = Math.min(leftNodes.length, rightNodes.length)
    const heights = [minLen].fill(0)

    for (let i = 0; i < minLen; i++) {
      const leftHeight = leftNodes[i].getBoundingClientRect().height
      const rightHeight = rightNodes[i].getBoundingClientRect().height
      heights[i] = Math.max(leftHeight, rightHeight)
    }

    for (let i = 0; i < minLen; i++) {
      if (heights[i] > 0) {
        leftNodes[i].style.minHeight = `${heights[i]}px`
        rightNodes[i].style.minHeight = `${heights[i]}px`
      }
    }
  }

  function performLayoutSync() {
    if (readerStore.isParallelView) {
      syncHeights()
    }
    restoreScrollPosition()
  }

  useResizeObserver(readerViewRef, () => {
    if (readerStore.isParallelView && !readerStore.isPageLoading) {
      syncHeights()
    }
  })

  return {
    performLayoutSync,
  }
}
