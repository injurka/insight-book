import { invoke } from '@tauri-apps/api/core'

export type ScreenOrientationMode = 'landscape' | 'portrait'

/**
 * Блокирует ориентацию экрана на Android для полноэкранных страниц плагинов.
 * `null` возвращает системное поведение (автоповорот по настройкам устройства).
 * На остальных платформах команда является no-op.
 */
export async function setScreenOrientation(mode: ScreenOrientationMode | null): Promise<void> {
  try {
    await invoke('set_screen_orientation', { mode })
  }
  catch (error) {
    console.warn('Failed to set screen orientation', error)
  }
}
