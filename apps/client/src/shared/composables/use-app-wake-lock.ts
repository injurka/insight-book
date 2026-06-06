import type { Ref } from 'vue'
import { useWakeLock } from '@vueuse/core'

/**
 * Универсальный хук для предотвращения блокировки экрана (Wake Lock).
 * @param trigger Реактивный флаг или функция, возвращающая boolean. Экран будет удерживаться активным, пока значение истинно.
 */
export function useAppWakeLock(trigger: Ref<boolean> | (() => boolean)) {
  const { isSupported, request, release } = useWakeLock()

  watch(trigger, async (isActive) => {
    if (!isSupported.value)
      return

    if (isActive) {
      try {
        await request('screen')
      }
      catch (err) {
        console.warn('Wake Lock request failed:', err)
      }
    }
    else {
      await release()
    }
  })
}
