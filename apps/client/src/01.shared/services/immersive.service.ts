import { invoke } from '@tauri-apps/api/core'

/**
 * Управляет системными панелями (статус-бар, навигационная панель) на Android
 * для полноэкранных страниц (страницы плагинов с `immersive: true`).
 * На остальных платформах команда является no-op.
 */
export async function setImmersiveMode(enabled: boolean): Promise<void> {
  try {
    await invoke('set_immersive_mode', { enabled })
  }
  catch (error) {
    console.warn('Failed to set immersive mode', error)
  }
}
