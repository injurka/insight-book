import type { Ref } from 'vue'
import { useIntersectionObserver, useMediaQuery } from '@vueuse/core'
import { computed, ref, watch } from 'vue'

export function useInlineCanvasLock(target: Ref<HTMLElement | null>, isFullscreen: Ref<boolean>) {
  const hasCoarsePointer = useMediaQuery('(pointer: coarse)')
  const isUnlocked = ref(false)
  const showGestureToggle = computed(() => hasCoarsePointer.value && !isFullscreen.value)
  const isTouchLocked = computed(() => showGestureToggle.value && !isUnlocked.value)

  function lock() {
    isUnlocked.value = false
  }

  function toggleGestureLock() {
    isUnlocked.value = !isUnlocked.value
  }

  watch([target, showGestureToggle], lock)

  useIntersectionObserver(target, ([entry]) => {
    if (!entry?.isIntersecting)
      lock()
  })

  return { showGestureToggle, isTouchLocked, toggleGestureLock }
}
