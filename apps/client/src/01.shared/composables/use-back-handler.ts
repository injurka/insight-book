import { ref } from 'vue'

const handlers = ref<Array<() => void>>([])

export function useBackHandler() {
  const registerBackHandler = (handler: () => void) => {
    handlers.value.push(handler)

    return () => {
      const idx = handlers.value.indexOf(handler)
      if (idx !== -1)
        handlers.value.splice(idx, 1)
    }
  }

  const triggerBack = (): boolean => {
    if (handlers.value.length > 0) {
      const handler = handlers.value[handlers.value.length - 1]
      handler()

      return true // Handled
    }

    return false // Not handled
  }

  return { registerBackHandler, triggerBack }
}
