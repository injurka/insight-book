import { getCurrentScope, onScopeDispose } from 'vue'

const handlers: Array<() => void> = []

export function useBackHandler() {
  const registrations = new Set<() => void>()

  function registerBackHandler(handler: () => void) {
    // Each registration has its own identity, even for the same callback.
    const entry = () => handler()
    handlers.push(entry)
    const unregister = () => {
      const index = handlers.indexOf(entry)

      if (index !== -1)
        handlers.splice(index, 1)

      registrations.delete(unregister)
    }
    registrations.add(unregister)

    return unregister
  }

  function triggerBack(): boolean {
    const handler = handlers.at(-1)

    if (!handler)
      return false

    handler()

    return true
  }

  if (getCurrentScope())
    onScopeDispose(() => registrations.forEach(unregister => unregister()))

  return { registerBackHandler, triggerBack }
}
