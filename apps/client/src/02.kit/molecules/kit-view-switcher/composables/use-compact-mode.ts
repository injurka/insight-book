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

    const clone = el.cloneNode(true) as HTMLElement
    clone.style.cssText = 'position: absolute !important; visibility: hidden !important; display: inline-flex !important; width: max-content !important; max-width: none !important; left: -9999px !important; top: -9999px !important; pointer-events: none !important;'

    const labels = clone.querySelectorAll('.kit-view-switcher-button.has-icon .kit-view-switcher-label')
    labels.forEach((label) => {
      (label as HTMLElement).style.display = 'inline'
    })

    document.body.appendChild(clone)
    naturalWidth = clone.offsetWidth
    document.body.removeChild(clone)
  }

  function checkOverflow() {
    const el = switcherRef.value
    if (!el || !el.parentElement)
      return

    const parent = el.parentElement
    const parentStyle = window.getComputedStyle(parent)
    const availableWidth = parent.clientWidth
      - Number.parseFloat(parentStyle.paddingLeft || '0')
      - Number.parseFloat(parentStyle.paddingRight || '0')

    if (naturalWidth > 0 && availableWidth > 0) {
      isCompact.value = naturalWidth > availableWidth
    }
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
