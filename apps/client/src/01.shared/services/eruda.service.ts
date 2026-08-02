import { isTauri } from '~/01.shared/lib/env'

/**
 * Включает eruda (отладочную консоль) внутри Tauri webview.
 * В tauri-сборке devtools по умолчанию недоступны, поэтому консоль eruda
 * позволяет смотреть логи прямо в приложении.
 */
export async function initEruda(): Promise<void> {
  if (!isTauri)
    return

  const { default: eruda } = await import('eruda')
  eruda.init()
}
