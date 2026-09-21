import { isTauri } from '~/01.shared/lib/env'

interface ErudaInstance {
  init: () => void
  destroy: () => void
}

let erudaInstance: ErudaInstance | null = null
let stateGeneration = 0

/**
 * Включает или выключает eruda (отладочную консоль) внутри Tauri webview.
 * В tauri-сборке devtools по умолчанию недоступны, поэтому консоль eruda
 * позволяет смотреть логи прямо в приложении.
 */
export async function setErudaEnabled(enabled: boolean): Promise<void> {
  if (!isTauri)
    return

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
