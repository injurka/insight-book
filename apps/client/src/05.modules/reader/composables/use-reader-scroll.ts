import type { Ref } from 'vue'
import { ref, watch } from 'vue'
import { useAnalysisStore } from '~/01.shared/store/analysis/analysis.store'
import { useReaderStore } from '../store/reader.store'

export function useReaderScroll(saveScrollPosition: () => void, closeBubblePopover?: () => void, isRestoringScroll?: Ref<boolean>) {
  const analysisStore = useAnalysisStore()
  const readerStore = useReaderStore()
  const isHeaderVisible = ref(true)

  let lastScrollY = 0
  let scrollAccumulator = 0

  // Порог вниз для скрытия (40px) и чувствительный порог вверх для быстрого появления (15px)
  const HIDE_THRESHOLD = 40
  const SHOW_THRESHOLD = 15

  function updateHeaderVisibility(currentY: number, delta: number) {
    // В самом верху страницы (до 60px) шапка всегда видима
    if (currentY < 60) {
      isHeaderVisible.value = true
      scrollAccumulator = 0

      return
    }

    // Сбрасываем аккумулированное значение при смене направления скролла
    if ((delta > 0 && scrollAccumulator < 0) || (delta < 0 && scrollAccumulator > 0))
      scrollAccumulator = 0

    scrollAccumulator += delta

    // Скрытие при скролле вниз
    if (scrollAccumulator >= HIDE_THRESHOLD) {
      isHeaderVisible.value = false
      scrollAccumulator = HIDE_THRESHOLD
    }
    // Быстрое появление при чутком движении вверх
    else if (scrollAccumulator <= -SHOW_THRESHOLD) {
      isHeaderVisible.value = true
      scrollAccumulator = -SHOW_THRESHOLD
    }
  }

  function onScroll(e: Event) {
    if (analysisStore.wordPopover)
      analysisStore.closePopover()
    if (analysisStore.selectionTooltip)
      analysisStore.closeSelectionTooltip()
    if (closeBubblePopover)
      closeBubblePopover()

    saveScrollPosition()

    const target = e.target as HTMLElement
    const currentY = Math.max(0, target.scrollTop)
    const delta = currentY - lastScrollY
    lastScrollY = currentY

    if (isRestoringScroll?.value) {
      scrollAccumulator = 0

      return
    }

    // Игнорируем скачки позиции при восстановлении скролла или резкой смене контента
    if (Math.abs(delta) > 300) {
      scrollAccumulator = 0

      return
    }

    updateHeaderVisibility(currentY, delta)
  }

  // При смене страницы сбрасываем скролл-аккумулятор и возвращаем видимость шапки
  watch(() => readerStore.currentPage?.pageNum, () => {
    isHeaderVisible.value = true
    lastScrollY = 0
    scrollAccumulator = 0
  })

  return {
    isHeaderVisible,
    onScroll,
  }
}
