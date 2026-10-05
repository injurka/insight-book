import { invoke } from '@tauri-apps/api/core'

/** Synchronize Android icon contrast with the resolved application theme. */
export async function syncSystemBarsTheme(dark: boolean): Promise<void> {
  try {
    await invoke('set_system_bars_theme', { dark })
  }
  catch (error) {
    console.warn('Failed to synchronize system bars theme', error)
  }
}
