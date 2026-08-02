import type { Ref } from 'vue'
import { onUnmounted, ref } from 'vue'

export function useGlider(switcherRef: Ref<HTMLElement | null>) {
  const gliderStyle = ref({
    opacity: 0,
    width: '0px',
    transform: 'translateX(0px)',
  })

  let observer: ResizeObserver | null = null
  let currentActiveBtn: HTMLElement | null = null

  function updatePosition() {
    const switcherEl = switcherRef.value
    if (!switcherEl)
      return

    const activeBtn = switcherEl.querySelector('.kit-view-switcher-button.is-active') as HTMLElement
    if (!activeBtn) {
      gliderStyle.value.opacity = 0

      return
    }

    const switcherRect = switcherEl.getBoundingClientRect()
    const buttonRect = activeBtn.getBoundingClientRect()

    const width = buttonRect.width
    if (width === 0)
      return

    const offsetLeft = buttonRect.left - switcherRect.left - switcherEl.clientLeft - 4

    gliderStyle.value = {
      opacity: 1,
      width: `${width}px`,
      transform: `translateX(${offsetLeft}px)`,
    }

    if (currentActiveBtn !== activeBtn) {
      if (observer)
        observer.disconnect()
      currentActiveBtn = activeBtn

      if (typeof ResizeObserver !== 'undefined') {
        observer = new ResizeObserver(() => {
          if (currentActiveBtn && switcherEl) {
            const newSwitcherRect = switcherEl.getBoundingClientRect()
            const newBtnRect = currentActiveBtn.getBoundingClientRect()
            const newWidth = newBtnRect.width
            if (newWidth > 0) {
              const newOffset = newBtnRect.left - newSwitcherRect.left - switcherEl.clientLeft - 4
              gliderStyle.value = {
                opacity: 1,
                width: `${newWidth}px`,
                transform: `translateX(${newOffset}px)`,
              }
            }
          }
        })
        observer.observe(currentActiveBtn)
      }
    }
  }

  onUnmounted(() => {
    if (observer)
      observer.disconnect()
  })

  return {
    gliderStyle,
    updatePosition,
  }
}
