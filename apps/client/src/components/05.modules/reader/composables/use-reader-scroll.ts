import { ref } from 'vue'
import { useAnalysisStore } from '~/shared/store/analysis/analysis.store'

export function useReaderScroll(saveScrollPosition: () => void, closeBubblePopover?: () => void) {
  const analysisStore = useAnalysisStore()
  const isHeaderVisible = ref(true)

  let lastScrollY = 0
  let scrollAccumulator = 0

  function onScroll(e: Event) {
    if (analysisStore.wordPopover) {
      analysisStore.closePopover()
    }
    if (analysisStore.selectionTooltip) {
      analysisStore.closeSelectionTooltip()
    }

    if (closeBubblePopover) {
      closeBubblePopover()
    }

    saveScrollPosition()

    const target = e.target as HTMLElement
    const currentY = Math.max(0, target.scrollTop)
    const delta = currentY - lastScrollY
    lastScrollY = currentY

    if (currentY < 80) {
      isHeaderVisible.value = true
      scrollAccumulator = 0
    }
    else {
      if ((delta > 0 && scrollAccumulator < 0) || (delta < 0 && scrollAccumulator > 0)) {
        scrollAccumulator = 0
      }
      scrollAccumulator += delta

      if (scrollAccumulator > 50) {
        isHeaderVisible.value = false
        scrollAccumulator = 50
      }
      else if (scrollAccumulator < -50) {
        isHeaderVisible.value = true
        scrollAccumulator = -50
      }
    }
  }

  return {
    isHeaderVisible,
    onScroll,
  }
}
