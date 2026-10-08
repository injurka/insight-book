import type { Ref } from 'vue'
import { onScopeDispose, ref, watch } from 'vue'

/**
 * Возвращает реактивный флаг загрузки, который становится true только если исходный isLoading
 * остается истинным дольше указанного времени (delayMs). Скрывается (становится false) мгновенно.
 */
export function useDelayedLoading(isLoading: Ref<boolean> | (() => boolean), delayMs = 300) {
  const isDelayedLoading = ref(false)
  let timer: ReturnType<typeof setTimeout> | null = null

  const stopWatch = watch(isLoading, (loading) => {
    if (timer !== null) {
      clearTimeout(timer)
      timer = null
    }

    if (loading) {
      timer = setTimeout(() => {
        timer = null
        isDelayedLoading.value = true
      }, delayMs)
    }
    else {
      isDelayedLoading.value = false
    }
  }, { immediate: true, flush: 'sync' })

  onScopeDispose(() => {
    if (timer !== null) {
      clearTimeout(timer)
    }

    isDelayedLoading.value = false
    stopWatch()
  })

  return isDelayedLoading
}
