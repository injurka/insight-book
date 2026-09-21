import { openUrl as tauriOpenUrl } from '@tauri-apps/plugin-opener'
import { isTauri } from './env'

/**
 * Открывает URL или локальный путь в системном браузере / стандартном приложении.
 * В Tauri использует нативный плагин opener, в обычном браузере — window.open.
 */
export async function openExternalUrl(url: string, target = '_blank'): Promise<void> {
  if (!url)
    return

  if (isTauri) {
    try {
      await tauriOpenUrl(url)

      return
    }
    catch (e) {
      console.warn('[Opener] Не удалось открыть через tauri-plugin-opener, используем window.open:', e)
    }
  }

  window.open(url, target)
}
