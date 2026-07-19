import type { UserDictItem } from '~/shared/types/models'

export interface AppEvents {
  'DICTIONARY:REQUEST_SAVE_WORD': Partial<UserDictItem> & { contextSentence?: string, contextBookId?: number }
  'DICTIONARY:REQUEST_REMOVE_WORD': string
  'DICTIONARY:WORD_SAVED': Partial<UserDictItem>
  'DICTIONARY:WORD_REMOVED': string
}

export class AppEventBus {
  private listeners = new Map<keyof AppEvents, Set<(data: any) => void>>()

  on<K extends keyof AppEvents>(event: K, callback: (data: AppEvents[K]) => void) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event)!.add(callback)
  }

  off<K extends keyof AppEvents>(event: K, callback: (data: AppEvents[K]) => void) {
    const set = this.listeners.get(event)
    if (set) {
      set.delete(callback as any)
      if (set.size === 0) {
        this.listeners.delete(event)
      }
    }
  }

  emit<K extends keyof AppEvents>(event: K, data: AppEvents[K]) {
    const set = this.listeners.get(event)
    if (set) {
      set.forEach((cb) => {
        try {
          cb(data)
        }
        catch (err) {
          console.error(`[App Event Bus] Error in listener for event "${String(event)}":`, err)
        }
      })
    }
  }

  clear() {
    this.listeners.clear()
  }
}

export const appEventBus = new AppEventBus()
