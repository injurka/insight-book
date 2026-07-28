import type { Ref } from 'vue'
import { ref } from 'vue'

export function useCompactMode(switcherRef: Ref<HTMLElement | null>) {
  const isCompact = ref(false)
  let naturalWidth = 0
  let parentObserver: ResizeObserver | null = null

  function measureNaturalWidth() {
    const el = switcherRef.value
    if (!el)
      return

    el.classList.add('is-measuring')
    naturalWidth = el.offsetWidth
    el.classList.remove('is-measuring')
  }

  function checkOverflow() {
    const el = switcherRef.value
    if (!el)
      return

    const parent = el.parentElement
    if (!parent)
      return

    const parentStyle = window.getComputedStyle(parent)
    const availableWidth = parent.clientWidth
      - Number.parseFloat(parentStyle.paddingLeft || '0')
      - Number.parseFloat(parentStyle.paddingRight || '0')

    isCompact.value = naturalWidth > availableWidth
  }

  function recalculate() {
    measureNaturalWidth()
    checkOverflow()
  }

  function observeParent() {
    const parent = switcherRef.value?.parentElement
    if (parent) {
      parentObserver = new ResizeObserver(() => checkOverflow())
      parentObserver.observe(parent)
    }
  }

  function unobserveParent() {
    if (parentObserver) {
      parentObserver.disconnect()
    }
  }

  return {
    isCompact,
    recalculate,
    observeParent,
    unobserveParent,
  }
}
