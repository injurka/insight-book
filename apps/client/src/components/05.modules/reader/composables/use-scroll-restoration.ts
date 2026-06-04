import type { Ref } from 'vue'
import { useDebounceFn } from '@vueuse/core'

export function useScrollRestoration(
  scrollContainerRef: Ref<HTMLElement | null> | Readonly<Ref<HTMLElement | null>>,
  getBookId: () => number | undefined,
  getPageNum: () => number | undefined,
) {
  const isRestoringScroll = ref(false)
  let restoreInterval: ReturnType<typeof setInterval> | null = null
  let restoreTimeout: ReturnType<typeof setTimeout> | null = null

  const saveScrollPosition = useDebounceFn(() => {
    if (isRestoringScroll.value || !scrollContainerRef.value)
      return
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
    if (!scrollContainerRef.value || !bookId || !pageNum)
      return

    const saved = localStorage.getItem(`insight_scroll_${bookId}_${pageNum}`)
    const percent = saved !== null ? Number.parseFloat(saved) : 0

    isRestoringScroll.value = true

    if (restoreInterval)
      clearInterval(restoreInterval)
    if (restoreTimeout)
      clearTimeout(restoreTimeout)

    const apply = () => {
      const el = scrollContainerRef.value
      if (!el)
        return
      const maxScroll = Math.max(1, el.scrollHeight - el.clientHeight)
      el.scrollTop = (Number.isNaN(percent) ? 0 : percent) * maxScroll
    }

    apply()

    let attempts = 0
    restoreInterval = setInterval(() => {
      apply()
      attempts++

      if (attempts >= 8) {
        if (restoreInterval)
          clearInterval(restoreInterval)
        restoreTimeout = setTimeout(() => {
          isRestoringScroll.value = false
        }, 100)
      }
    }, 50)
  }

  function setScrollIntent(bookId: number, pageNum: number, position: 'top' | 'bottom') {
    localStorage.setItem(`insight_scroll_${bookId}_${pageNum}`, position === 'top' ? '0' : '1')
  }

  return {
    isRestoringScroll,
    saveScrollPosition,
    restoreScrollPosition,
    setScrollIntent,
  }
}
