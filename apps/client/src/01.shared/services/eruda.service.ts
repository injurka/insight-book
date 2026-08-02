import { isTauri } from '~/01.shared/lib/env'

let erudaInstance: any = null

/**
 * Включает или выключает eruda (отладочную консоль) внутри Tauri webview.
 * В tauri-сборке devtools по умолчанию недоступны, поэтому консоль eruda
 * позволяет смотреть логи прямо в приложении.
 */
export async function setErudaEnabled(enabled: boolean): Promise<void> {
  if (!isTauri)
    return

  if (enabled && !erudaInstance) {
    const { default: eruda } = await import('eruda')
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
