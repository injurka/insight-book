import type { Ref } from 'vue'
import { ref, watch } from 'vue'

export function useGlider<T extends string | number>(switcherRef: Ref<HTMLElement | null>, buttonRefs: Ref<Record<string | number, HTMLElement>>, activeValue: Ref<T>) {
  const gliderStyle = ref({
    opacity: 0,
    width: '0px',
    transform: 'translateX(0px)',
    transition: 'none',
  })

  function updatePosition() {
    const switcherEl = switcherRef.value
    if (!switcherEl)
      return

    const activeButton = buttonRefs.value[activeValue.value]
    if (!activeButton) {
      gliderStyle.value.opacity = 0
      return
    }

    const switcherRect = switcherEl.getBoundingClientRect()
    const buttonRect = activeButton.getBoundingClientRect()

    const offsetLeft = buttonRect.left - switcherRect.left - switcherEl.clientLeft - 4
    const width = buttonRect.width

    gliderStyle.value = {
      ...gliderStyle.value,
      opacity: 1,
      width: `${width}px`,
      transform: `translateX(${offsetLeft}px)`,
    }
  }

  function enableTransition() {
    gliderStyle.value.transition = 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
  }

  function disableTransition() {
    gliderStyle.value.transition = 'none'
  }

  watch(activeValue, () => {
    enableTransition()
    updatePosition()
  }, { flush: 'post' })

  return {
    gliderStyle,
    updatePosition,
    enableTransition,
    disableTransition,
  }
}
