import type { Ref } from 'vue'
import { useMediaQuery, useSwipe } from '@vueuse/core'
import { ref, watch } from 'vue'

interface UseDialogSwipeOptions {
  headerRef: Ref<HTMLElement | null>
  visible: Ref<boolean>
  isMinimized: Ref<boolean>
  isFloating: Ref<boolean>
  isMinimizable: Ref<boolean>
}

export function useDialogSwipe({ headerRef, visible, isMinimized, isFloating, isMinimizable }: UseDialogSwipeOptions) {
  const isMobile = useMediaQuery('(max-width: 599px)')
  const swipeOffset = ref(0)
  const isSnappingBack = ref(false)

  const { lengthY, isSwiping, direction } = useSwipe(headerRef, {
    threshold: 10,
    onSwipeEnd: () => {
      if (isMobile.value && !isFloating.value && direction.value === 'down') {
        if (swipeOffset.value > 100) {
          if (isMinimizable.value) {
            isMinimized.value = true
          }
          else {
            visible.value = false
          }
        }
        else {
          isSnappingBack.value = true
          swipeOffset.value = 0
        }
      }
    },
  })

  watch(lengthY, (val) => {
    if (isMobile.value && !isFloating.value && isSwiping.value && direction.value === 'down') {
      swipeOffset.value = Math.abs(val)
      isSnappingBack.value = false
    }
  })

  watch([visible, isMinimized], ([v, m]) => {
    if (!v || m) {
      setTimeout(() => {
        swipeOffset.value = 0
        isSnappingBack.value = false
      }, 300)
    }
    else {
      swipeOffset.value = 0
      isSnappingBack.value = false
    }
  })

  return {
    isMobile,
    isSwiping,
    direction,
    swipeOffset,
    isSnappingBack,
  }
}
