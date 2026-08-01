import type { InsightBookPluginEventBus } from '../types'

export class MockEventBus implements InsightBookPluginEventBus {
  private listeners: Map<string, Set<(data: unknown) => void>> = new Map()

  on(event: string, callback: (data: unknown) => void): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event)!.add(callback)
  }

  off(event: string, callback: (data: unknown) => void): void {
    const set = this.listeners.get(event)
    if (set) {
      set.delete(callback)
    }
  }

  emit(event: string, data?: unknown): void {
    const set = this.listeners.get(event)
    if (set) {
      set.forEach(fn => fn(data))
    }
  }
}
