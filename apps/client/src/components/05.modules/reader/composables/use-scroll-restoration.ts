import type { Ref } from 'vue'
import { useDebounceFn } from '@vueuse/core'
import { ref } from 'vue'

export function useScrollRestoration(
  scrollContainerRef: Ref<HTMLElement | null> | Readonly<Ref<HTMLElement | null>>,
  getBookId: () => number | undefined,
  getPageNum: () => number | undefined,
  getIsLoading: () => boolean,
) {
  const isRestoringScroll = ref(false)
  let restoreInterval: ReturnType<typeof setInterval> | null = null

  const saveScrollPosition = useDebounceFn(() => {
    if (isRestoringScroll.value || !scrollContainerRef.value || getIsLoading()) {
      return
    }
    const bookId = getBookId()
    const pageNum = getPageNum()
    if (!bookId || !pageNum)
      return

    const el = scrollContainerRef.value
    const maxScroll = Math.max(1, el.scrollHeight - el.clientHeight)

    if (maxScroll <= 1)
      return

    const scrollPercent = Math.max(0, Math.min(1, el.scrollTop / maxScroll))
    localStorage.setItem(`insight_scroll_${bookId}_${pageNum}`, scrollPercent.toString())
  }, 300)

  function restoreScrollPosition() {
    const bookId = getBookId()
    const pageNum = getPageNum()
    if (!scrollContainerRef.value || !bookId || !pageNum) {
      return
    }

    const saved = localStorage.getItem(`insight_scroll_${bookId}_${pageNum}`)
    const percent = saved !== null ? Number.parseFloat(saved) : 0

    isRestoringScroll.value = true

    if (restoreInterval)
      clearInterval(restoreInterval)

    const el = scrollContainerRef.value
    let attempts = 0
    let stableCount = 0
    let lastHeight = 0

    const stopRestoration = () => {
      if (restoreInterval)
        clearInterval(restoreInterval)

      isRestoringScroll.value = false

      el.removeEventListener('wheel', stopRestoration)
      el.removeEventListener('touchstart', stopRestoration)
      el.removeEventListener('mousedown', stopRestoration)
    }

    el.addEventListener('wheel', stopRestoration, { passive: true, once: true })
    el.addEventListener('touchstart', stopRestoration, { passive: true, once: true })
    el.addEventListener('mousedown', stopRestoration, { passive: true, once: true })

    const apply = () => {
      const maxScroll = Math.max(1, el.scrollHeight - el.clientHeight)
      const target = (Number.isNaN(percent) ? 0 : percent) * maxScroll
      el.scrollTop = target

      if (el.scrollHeight === lastHeight && el.scrollHeight > el.clientHeight) {
        stableCount++
      }
      else {
        stableCount = 0
        lastHeight = el.scrollHeight
      }

      if (stableCount >= 3 || attempts >= 25) {
        stopRestoration()
      }
    }

    apply()
    restoreInterval = setInterval(() => {
      attempts++
      apply()
    }, 50)
  }

  function setScrollIntent(bookId: number, pageNum: number, position: 'top' | 'bottom') {
    const percent = position === 'top' ? '0' : '1'
    localStorage.setItem(`insight_scroll_${bookId}_${pageNum}`, percent)
  }

  return {
    isRestoringScroll,
    saveScrollPosition,
    restoreScrollPosition,
    setScrollIntent,
  }
}
