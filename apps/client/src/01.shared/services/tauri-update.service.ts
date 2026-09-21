import type { Pinia } from 'pinia'
import { isTauri } from '~/01.shared/lib/env'
import { useAppUpdateStore } from '~/01.shared/store/app-update.store'

export async function checkForTauriUpdate(pinia: Pinia, _ignorePromptCooldown = false): Promise<boolean> {
  if (!isTauri)
    return false

  const appUpdateStore = useAppUpdateStore(pinia)

  return await appUpdateStore.checkForUpdates(false)
}

export async function initializeTauriUpdater(pinia: Pinia): Promise<void> {
  if (!isTauri)
    return

  const appUpdateStore = useAppUpdateStore(pinia)
  await appUpdateStore.checkForUpdates(true)
}
