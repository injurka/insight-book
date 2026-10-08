import type { Ref } from 'vue'
import { useWakeLock } from '@vueuse/core'
import { onScopeDispose, watch } from 'vue'

/** Keeps the screen awake while the reactive trigger is active. */
export function useAppWakeLock(trigger: Ref<boolean> | (() => boolean)) {
  const { isSupported, request, release } = useWakeLock()
  let active = false
  let disposed = false
  let pending = Promise.resolve()

  function syncLock() {
    pending = pending.then(async () => {
      if (!isSupported.value)
        return

      try {
        if (active && !disposed)
          await request('screen')
        else
          await release()
      }
      catch (error) {
        console.warn('Wake Lock update failed:', error)
      }
    })
  }

  watch([trigger, isSupported], ([value]) => {
    active = value
    syncLock()
  }, { immediate: true, flush: 'sync' })

  onScopeDispose(() => {
    disposed = true
    syncLock()
  })
}
