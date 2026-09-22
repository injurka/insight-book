interface ErudaInstance {
  init: () => void
  destroy: () => void
}

let erudaInstance: ErudaInstance | null = null
let stateGeneration = 0

/**
 * Включает или выключает eruda (отладочную консоль).
 * Позволяет смотреть логи и отлаживать прямо в приложении (Tauri APK, PWA и веб-окружение).
 */
export async function setErudaEnabled(enabled: boolean): Promise<void> {
  const generation = ++stateGeneration

  if (enabled && !erudaInstance) {
    const { default: eruda } = await import('eruda')

    if (generation !== stateGeneration)
      return

    erudaInstance = eruda
    erudaInstance.init()
  }
  else if (!enabled && erudaInstance) {
    try {
      erudaInstance.destroy()
    }
    catch (e) {
      console.error('Failed to destroy eruda:', e)
    }

    erudaInstance = null
  }
}
